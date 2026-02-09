<?php
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

// Path for error logging
define('LOG_FILE', __DIR__ . '/error.log');

function getCsrfToken() {
    if (empty($_SESSION['csrf_token'])) {
        $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
    }
    return $_SESSION['csrf_token'];
}

function verifyCsrfToken($token) {
    $sessionToken = $_SESSION['csrf_token'] ?? '';
    $match = !empty($token) && hash_equals($sessionToken, $token);
    if (!$match) {
        error_log("CSRF Mismatch: Provided [" . ($token ?: 'EMPTY') . "], Session: [" . ($sessionToken ?: 'EMPTY') . "] from " . $_SERVER['PHP_SELF'] . PHP_EOL, 3, LOG_FILE);
    }
    return $match;
}

function verifyCsrfHeader() {
    $token = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';
    return verifyCsrfToken($token);
}

// Custom error and exception handling functions
function handleException($exception) {
    $message = 'Exception: ' . $exception->getMessage();
    if (!error_log($message . PHP_EOL, 3, LOG_FILE)) {
        error_log($message);
    }
    echo json_encode(['error' => 'An error occurred. Please try again later.']);
    exit();
}

function handleError($errno, $errstr, $errfile, $errline) {
    $message = "Error: [$errno] $errstr - $errfile:$errline";
    if (!error_log($message . PHP_EOL, 3, LOG_FILE)) {
        error_log($message);
    }

    // Only stop execution for fatal errors
    if ($errno & (E_ERROR | E_USER_ERROR | E_RECOVERABLE_ERROR)) {
        echo json_encode(['error' => 'An error occurred. Please try again later.']);
        exit();
    }

    // Allow script to continue for warnings and notices
    return true;
}

// Attempt to move a file even if the destination is on a different filesystem
if (!function_exists('safeMove')) {
function safeMove($source, $dest) {
    if (@rename($source, $dest)) {
        return true;
    }

    $error = error_get_last();
    if ($error) {
        error_log('Rename failed: ' . $error['message'] . PHP_EOL, 3, LOG_FILE);
    }

    if (@copy($source, $dest)) {
        if (@unlink($source)) {
            return true;
        }
        error_log('Unable to remove original file after copy: ' . $source . PHP_EOL, 3, LOG_FILE);
    }

    return false;
}
}

// Set custom error and exception handlers
set_exception_handler('handleException');
set_error_handler('handleError');

// Define a constant for the database path so all scripts use the same absolute path
if (!defined('DB_PATH')) {
    $defaultPath = __DIR__ . '/db.sqlite';
    if (!is_writable(dirname($defaultPath))) {
        $defaultPath = sys_get_temp_dir() . '/sujib_db.sqlite';
    }
    define('DB_PATH', $defaultPath);
}

// Path for error logging
if (!defined('LOG_FILE')) {
    $defaultLog = __DIR__ . '/error.log';
    if (!is_writable(dirname($defaultLog))) {
        $defaultLog = sys_get_temp_dir() . '/sujib_error.log';
    }
    define('LOG_FILE', $defaultLog);
}

// Define a constant for the cache directory. Fallback to /tmp if not writable
if (!defined('CACHE_DIR')) {
    $defaultCache = __DIR__ . '/cache';
    if (!is_writable(dirname($defaultCache))) {
        $defaultCache = sys_get_temp_dir() . '/sujib_cache';
    }
    define('CACHE_DIR', $defaultCache);
}

function truncate($string, $length=50, $append="&hellip;") {
    $string = trim($string);
    if (strlen($string) > $length) {
        $string = wordwrap($string, $length);
        $string = explode("\n", $string, 2);
        $string = $string[0] . $append;
    }
    return $string;
}

// Validate a YouTube URL and extract the video ID. Returns false on failure.
function analyze_url($url) {
    // Use yt-dlp to get JSON info without downloading
    // --flat-playlist: extract only the titles and IDs
    $cmd = 'yt-dlp --js-runtimes node:/usr/bin/node --remote-components ejs:github --dump-single-json --flat-playlist --quiet ' . escapeshellarg($url);
    $output = shell_exec($cmd);
    if (!$output) return false;

    $data = json_decode($output, true);
    if (!$data) return false;

    if (isset($data['_type']) && $data['_type'] === 'playlist') {
        $videos = [];
        foreach ($data['entries'] as $entry) {
            $videos[] = [
                'id' => $entry['id'],
                'title' => $entry['title'],
                'url' => 'https://www.youtube.com/watch?v=' . $entry['id']
            ];
        }
        return [
            'type' => 'playlist',
            'title' => $data['title'] ?? 'Playlist',
            'videos' => $videos
        ];
    } else {
        return [
            'type' => 'video',
            'id' => $data['id'],
            'title' => $data['title'],
            'url' => $url
        ];
    }
}

function extract_video_id($url) {
    $url = filter_var($url, FILTER_SANITIZE_URL);
    if (filter_var($url, FILTER_VALIDATE_URL) === false) {
        return false;
    }

    preg_match('#(?<=(?:v|i)=)[a-zA-Z0-9-]+(?=&)|(?<=(?:v|i)/)[^&\n]+|(?<=embed/)[^"&\n]+|(?<=(?:v|i)=)[^&\n]+|(?<=youtu.be/)[^&\n]+#', $url, $matches);

    return $matches[0] ?? false;
}

function initializeDatabase() {
    $dbPath = DB_PATH;

    $dir = dirname($dbPath);
    if (!is_dir($dir) && !mkdir($dir, 0777, true)) {
        throw new Exception("Unable to create directory for database: $dir");
    }

    if (!file_exists($dbPath)) {
        if (!touch($dbPath)) {
            throw new Exception("Unable to create database file: $dbPath");
        }
        if (!chmod($dbPath, 0666)) {
            throw new Exception("Unable to set permissions on database file: $dbPath");
        }
    }

    $database = connectDatabase();
    if (!$database) {
        throw new Exception("Unable to open database: " . $database->lastErrorMsg());
    }

    createTables($database);
    insertDefaultValues($database);

    return $database;
}

function connectDatabase() {
    $db = new SQLite3(DB_PATH);
    $db->busyTimeout(5000); // 5 seconds
    return $db;
}

function createTables($database) {
    $tables = [
        'profiles' => "CREATE TABLE IF NOT EXISTS profiles (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            reorder TEXT,
            command_line TEXT,
            name TEXT,
            destination TEXT,
            dest_path TEXT,
            container TEXT,
            max_res TEXT,
            min_res TEXT,
            audio TEXT,
            video TEXT,
            cache TEXT,
            directory_id INTEGER,
            FOREIGN KEY(directory_id) REFERENCES directories(id)
        )",
        'options' => "CREATE TABLE IF NOT EXISTS options (
            id INTEGER PRIMARY KEY,
            download_dir TEXT,
            rename_regex TEXT,
            show_last INTEGER DEFAULT 20,
            subtitles INTEGER DEFAULT 0,
            sub_lang TEXT DEFAULT 'en'
        )",
        'queue' => "CREATE TABLE IF NOT EXISTS queue (
            id INTEGER PRIMARY KEY,
            video_id TEXT,
            wait INTEGER,
            filename TEXT,
            size TEXT,
            date TEXT,
            command TEXT,
            progress TEXT DEFAULT '0%',
            pid INTEGER,
            dest_path TEXT
        )",
        'downloaded' => "CREATE TABLE IF NOT EXISTS downloaded (
            id INTEGER PRIMARY KEY,
            video_id TEXT,
            resolution TEXT,
            codec_v TEXT,
            codec_a TEXT,
            bitrate_v TEXT,
            bitrate_a TEXT,
            duration TEXT,
            filename TEXT,
            size TEXT,
            date TEXT,
            tid INTEGER
        )",
        'directories' => "CREATE TABLE IF NOT EXISTS directories (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            path TEXT NOT NULL,
            description TEXT
        )"
    ];

    foreach ($tables as $name => $sql) {
        $database->exec($sql);
    }

    // Ensure dest_path column exists for backward compatibility
    $columns = $database->query('PRAGMA table_info(profiles)');
    $destPathExists = false;
    while ($col = $columns->fetchArray(SQLITE3_ASSOC)) {
        if ($col['name'] === 'dest_path') {
            $destPathExists = true;
            break;
        }
    }
    if (!$destPathExists) {
        $database->exec('ALTER TABLE profiles ADD COLUMN dest_path TEXT');
    }
}

function insertDefaultValues($database) {
    $result = $database->query("SELECT COUNT(*) as count FROM options");
    $row = $result->fetchArray(SQLITE3_ASSOC);

    if ($row['count'] == 0) {
        $script_path = realpath(dirname(__FILE__));
        $insert_default_values_query = "INSERT INTO options (id, download_dir, rename_regex, show_last, subtitles, sub_lang) VALUES (1, '$script_path', '', 20, 0, 'en')";
        if (!$database->exec($insert_default_values_query)) {
            throw new Exception("Error inserting options: " . $database->lastErrorMsg());
        }
    }

    $profileResult = $database->query("SELECT COUNT(*) as count FROM profiles");
    $profileRow = $profileResult->fetchArray(SQLITE3_ASSOC);

    if ($profileRow['count'] == 0) {
        $cache_dir = rtrim(CACHE_DIR, '/') . '/';
        $destination = '%(title)s.%(ext)s';
        $default_profiles = [
            "INSERT INTO profiles (id, reorder, command_line, name, destination, dest_path, container, max_res, min_res, audio, video, cache) VALUES (1, '1', '-w --encoding UTF-8 --no-progress', 'video-highest (4K)', '$destination', '', 'mkv', NULL, '1080', 'bestaudio', 'bestvideo', '--cache-dir $cache_dir')",
            "INSERT INTO profiles (id, reorder, command_line, name, destination, dest_path, container, max_res, min_res, audio, video, cache) VALUES (2, '2', '-w --encoding UTF-8 --no-progress', 'video-1080p (1080P)', '$destination', '', 'mkv', '1080', NULL, 'bestaudio', 'bestvideo', '--cache-dir $cache_dir')",
            "INSERT INTO profiles (id, reorder, command_line, name, destination, dest_path, container, max_res, min_res, audio, video, cache) VALUES (4, '4', '-w --encoding UTF-8 --no-progress', 'video-1440p (1440P)', '$destination', '', 'mkv', '1440', NULL, 'bestaudio', 'bestvideo', '--cache-dir $cache_dir')",
            "INSERT INTO profiles (id, reorder, command_line, name, destination, dest_path, container, max_res, min_res, audio, video, cache) VALUES (5, '5', '-w --encoding UTF-8 --no-progress', 'video-720p (720P)', '$destination', '', 'mkv', '720', NULL, 'bestaudio', 'bestvideo', '--cache-dir $cache_dir')"
        ];

        foreach ($default_profiles as $profile) {
            if (!$database->exec($profile)) {
                throw new Exception("Error inserting profile: " . $database->lastErrorMsg());
            }
        }
    }
}

function fetchOptions($database) {
    $result = $database->query("SELECT download_dir, rename_regex, show_last, subtitles, sub_lang FROM options WHERE id = 1");
    if ($row = $result->fetchArray(SQLITE3_ASSOC)) {
        return [
            'download_dir' => $row['download_dir'],
            'rename_regex' => $row['rename_regex'],
            'show_last' => $row['show_last'],
            'subtitles' => $row['subtitles'],
            'sub_lang' => $row['sub_lang'],
        ];
    }

    return [
        'download_dir' => '',
        'rename_regex' => '',
        'show_last' => 20,
        'subtitles' => 0,
        'sub_lang' => 'en',
    ];
}


function fetchProfile($database, $pid) {
    $select = $database->prepare('SELECT * FROM profiles WHERE id = :pid');
    $select->bindValue(':pid', $pid, SQLITE3_TEXT);
    $result = $select->execute();
    return $result->fetchArray(SQLITE3_ASSOC);
}

function determineQuality($profile) {
    if (isset($profile['min_res']) && !empty($profile['min_res']) && is_numeric($profile['min_res'])) {
        $quality = '-f "bv*[height>=' . intval($profile['min_res']) . ']+ba/b[height>=' . intval($profile['min_res']) . '] / wv*+ba/w"';
    } elseif (isset($profile['max_res']) && !empty($profile['max_res']) && is_numeric($profile['max_res'])) {
        $quality = '-f "bv*[height<=' . intval($profile['max_res']) . ']+ba/b[height<=' . intval($profile['max_res']) . '] / wv*+ba/w"';
    } else {
        $quality = '-f "bv*[height<=1080]+ba/b[height<=1080] / wv*+ba/w"';
    }
    //error_log("Determined quality: " . $quality); // Log the generated command
    return $quality;
}



function executeCommand($cmd) {
    $output = [];
    exec($cmd, $output, $return_var);
    if ($return_var !== 0) {
        //error_log("Command Error: $cmd");
        return ['N/A'];
    }
    return $output;
}

function insertIntoQueue($database, $video_id, $filesql, $command = '', $dest_path = '') {
    $stmt = $database->prepare("INSERT INTO 'queue' ('video_id', 'wait', 'filename', 'size', 'date', 'command', 'dest_path') VALUES (:video_id, '0', :filename, '', '', :command, :dest_path)");
    $stmt->bindValue(':video_id', $video_id, SQLITE3_TEXT);
    $stmt->bindValue(':filename', $filesql, SQLITE3_TEXT);
    $stmt->bindValue(':command', $command, SQLITE3_TEXT);
    $stmt->bindValue(':dest_path', $dest_path, SQLITE3_TEXT);
    $stmt->execute();
    return $database->lastInsertRowid();
}

function fetchMediaInfo($file_dl) {
    $cmd = 'mediainfo --Output=JSON "' . $file_dl . '"';
    $output = shell_exec($cmd);
    $data = json_decode($output, true);

    $general = [];
    $video = [];
    $audio = [];

    if (isset($data['media']['track'])) {
        foreach ($data['media']['track'] as $track) {
            if ($track['@type'] === 'General') {
                $general = $track;
            } elseif ($track['@type'] === 'Video' && empty($video)) {
                $video = $track;
            } elseif ($track['@type'] === 'Audio' && empty($audio)) {
                $audio = $track;
            }
        }
    }

    $mediainfo = [
        'resolution'    => isset($video['Width'], $video['Height']) ? $video['Width'] . 'x' . $video['Height'] : 'N/A',
        'codec'         => $video['CodecID'] ?? 'N/A',
        'size'          => isset($general['FileSize']) ? round($general['FileSize'] / 1024 / 1024, 2) . ' MiB' : 'N/A',
        'codec_audio'   => $audio['CodecID'] ?? 'N/A',
        'bitrate'       => isset($video['BitRate']) ? round($video['BitRate'] / 1000) . ' kbps' : 'N/A',
        'bitrate_audio' => isset($audio['BitRate']) ? round($audio['BitRate'] / 1000) . ' kbps' : 'N/A',
        'duration'      => isset($general['Duration']) ? gmdate("H:i:s", (int)$general['Duration']) : 'N/A',
    ];

    // Escape for SQLite
    foreach ($mediainfo as $key => $value) {
        $mediainfo[$key] = SQLite3::escapeString($value);
    }

    return $mediainfo;
}


function insertIntoDownloaded($database, $video_id, $mediainfo, $filename, $date, $temprowid) {
    $stmt = $database->prepare("INSERT INTO 'downloaded' 
        ('video_id', 'resolution', 'codec_v', 'codec_a', 'bitrate_v', 'bitrate_a', 'duration', 'filename', 'size', 'date', 'tid') 
        VALUES (:video_id, :resolution, :codec_v, :codec_a, :bitrate_v, :bitrate_a, :duration, :filename, :size, :date, :tid)");
    
    $stmt->bindValue(':video_id', $video_id, SQLITE3_TEXT);
    $stmt->bindValue(':resolution', $mediainfo['resolution'], SQLITE3_TEXT);
    $stmt->bindValue(':codec_v', $mediainfo['codec'], SQLITE3_TEXT);
    $stmt->bindValue(':codec_a', $mediainfo['codec_audio'], SQLITE3_TEXT);
    $stmt->bindValue(':bitrate_v', $mediainfo['bitrate'], SQLITE3_TEXT);
    $stmt->bindValue(':bitrate_a', $mediainfo['bitrate_audio'], SQLITE3_TEXT);
    $stmt->bindValue(':duration', $mediainfo['duration'], SQLITE3_TEXT);
    $stmt->bindValue(':filename', $filename, SQLITE3_TEXT);
    $stmt->bindValue(':size', $mediainfo['size'], SQLITE3_TEXT);
    $stmt->bindValue(':date', $date, SQLITE3_TEXT);
    $stmt->bindValue(':tid', $temprowid, SQLITE3_INTEGER);

    $result = $stmt->execute();
    if (!$result) {
        //error_log("Database Insert Error: " . $database->lastErrorMsg());
        throw new Exception("Database Insert Error: " . $database->lastErrorMsg());
    }

    return $database->lastInsertRowid();
}


function removeFromQueue($database, $temprowid) {
    $stmt = $database->prepare("DELETE FROM queue WHERE id = :id");
    $stmt->bindValue(':id', $temprowid, SQLITE3_INTEGER);
    $stmt->execute();
}

function render($template, $vars = []) {
    extract($vars);
    ob_start();
    include 'templates/' . $template . '.phtml';
    return ob_get_clean();
}

function createTable($filename, $mediainfo, $date) {
    return render('download_table', [
        'filename' => $filename,
        'mediainfo' => $mediainfo,
        'date' => $date
    ]);
}

function fetchRecordById($database, $id) {
    $select = $database->prepare('SELECT * FROM downloaded WHERE id=:gid');
    $select->bindValue(':gid', $id, SQLITE3_INTEGER);
    return $select->execute();
}

function updateFilename($database, $newFilename, $id) {
    $update = $database->prepare('UPDATE downloaded SET filename=:newFilename WHERE id=:gid');
    $update->bindParam(':newFilename', $newFilename, SQLITE3_TEXT);
    $update->bindParam(':gid', $id, SQLITE3_TEXT);
    $update->execute();
}

function handleRenameRequest($id, $newName) {
    $database = connectDatabase();

    // Validate new filename
    $isValid = $newName !== '' &&
               strpos($newName, '/') === false &&
               strpos($newName, "\\") === false &&
               strpos($newName, '..') === false;

    if (!$isValid) {
        echo 'Invalid filename';
        $database->close();
        return;
    }

    $result = fetchRecordById($database, $id);

    while ($val = $result->fetchArray()) {
        $oldFilename = pathinfo($val['filename']);
        $path = $oldFilename['dirname'];
        $ext = $oldFilename['extension'];
        $newFilename = $path . "/" . stripslashes($newName) . "." . $ext;
        $newFilenameSql = $path . "/" . stripslashes(SQLite3::escapeString($newName)) . "." . $ext;

        if (file_exists($val['filename'])) {
            if (safeMove($val['filename'], $newFilename)) {
                updateFilename($database, $newFilenameSql, $id);
                echo basename($newFilename);
            } else {
                error_log('Failed to rename ' . $val['filename'] . ' to ' . $newFilename . PHP_EOL, 3, LOG_FILE);
                echo basename($val['filename']);
            }
        }
    }

    $database->close();
}

function renderRenameForm($id, $filename) {
    $file = pathinfo($filename);
    echo render('rename_form', [
        'id' => $id,
        'filenameWithoutExt' => $file['filename']
    ]);
}

function renderFileNotFound($filename) {
    $file = pathinfo($filename);
    echo render('file_not_found', [
        'filename' => $file['filename'],
        'extension' => $file['extension'] ?? ''
    ]);
}

function handleQueueRequest($id) {
    $database = connectDatabase();
    
    // Check if it's still in queue
    $stmtQueue = $database->prepare('SELECT * FROM queue WHERE id = :id');
    $stmtQueue->bindValue(':id', $id, SQLITE3_INTEGER);
    $resQueue = $stmtQueue->execute();
    $check = $resQueue->fetchArray();

    if ($check) {
        echo json_encode(['status' => 'downloading', 'progress' => $check['progress']]);
    } else {
        // If not in queue, check if it's in downloaded
        // We use the tid (temprowid) which is the original queue ID
        // Order by id DESC to get the most recent one in case of ID reuse
        $stmtDl = $database->prepare('SELECT * FROM downloaded WHERE tid = :tid ORDER BY id DESC LIMIT 1');
        $stmtDl->bindValue(':tid', $id, SQLITE3_INTEGER);
        $resDl = $stmtDl->execute();

        if ($val2 = $resDl->fetchArray(SQLITE3_ASSOC)) {
            $mediainfo = [
                'resolution' => $val2['resolution'],
                'codec' => $val2['codec_v'],
                'codec_audio' => $val2['codec_a'],
                'bitrate' => $val2['bitrate_v'],
                'bitrate_audio' => $val2['bitrate_a'],
                'duration' => $val2['duration'],
                'size' => $val2['size']
            ];
            $table = createTable(basename($val2['filename']), $mediainfo, $val2['date']);
            $arr = ['id' => $val2['id'], 'table' => $table];
            echo json_encode($arr);
        }
    }

    $database->close();
}

function generateFileTable($fileInfo) {
    $mediainfo = [
        'resolution' => $fileInfo['resolution'],
        'codec' => $fileInfo['codec_v'],
        'codec_audio' => $fileInfo['codec_a'],
        'bitrate' => $fileInfo['bitrate_v'],
        'bitrate_audio' => $fileInfo['bitrate_a'],
        'duration' => $fileInfo['duration'],
        'size' => $fileInfo['size']
    ];
    return createTable(basename($fileInfo['filename']), $mediainfo, $fileInfo['date']);
}

function deleteFile($database, $id, $deleteFromDisk = false) {
    $select = $database->prepare('SELECT * FROM downloaded WHERE id=:id');
    $select->bindValue(':id', $id, SQLITE3_INTEGER);
    $result = $select->execute();

    while ($val = $result->fetchArray(SQLITE3_ASSOC)) {
        if ($deleteFromDisk && !empty($val['filename']) && file_exists($val['filename'])) {
            @unlink($val['filename']);
        }
        $delete = $database->prepare('DELETE FROM downloaded WHERE id=:id');
        $delete->bindValue(':id', $id, SQLITE3_INTEGER);
        $delete->execute();
        echo 'done';
    }
}

function terminateDownload($database, $id) {
    $stmt = $database->prepare("SELECT pid, filename FROM queue WHERE id = :id");
    $stmt->bindValue(':id', $id, SQLITE3_INTEGER);
    $result = $stmt->execute();
    $job = $result->fetchArray(SQLITE3_ASSOC);

    if ($job) {
        $pid = $job['pid'];
        $filename = $job['filename'];

        if ($pid) {
            // Kill the process and its children
            // On Linux, we can kill the process group if we started it as such, 
            // but for now let's just kill the PID.
            exec("kill -9 $pid > /dev/null 2>&1");
        }

        // Remove partial file if it exists
        if (file_exists($filename)) {
            @unlink($filename);
        }
        // Also remove .part file created by yt-dlp
        if (file_exists($filename . '.part')) {
            @unlink($filename . '.part');
        }

        // Remove from queue
        removeFromQueue($database, $id);
        return true;
    }
    return false;
}

function generateDeleteForm($filename, $extension, $id) {
    return render('delete_form', [
        'truncatedFilename' => truncate($filename),
        'extension' => $extension,
        'id' => $id
    ]);
}

function handleFileNotFound($filename, $extension) {
    return render('file_not_found', [
        'filename' => truncate($filename),
        'extension' => $extension
    ]);
}

function saveOptions($database, $download_dir, $rename_regex, $show_last, $subtitles, $sub_lang) {
    $update = $database->prepare('UPDATE options SET download_dir = :download_dir, rename_regex = :rename_regex, show_last = :show_last, subtitles = :subtitles, sub_lang = :sub_lang WHERE id = 1');
    $update->bindParam(':download_dir', $download_dir, SQLITE3_TEXT);
    $update->bindParam(':rename_regex', $rename_regex, SQLITE3_TEXT);
    $update->bindParam(':show_last', $show_last, SQLITE3_INTEGER);
    $update->bindParam(':subtitles', $subtitles, SQLITE3_INTEGER);
    $update->bindParam(':sub_lang', $sub_lang, SQLITE3_TEXT);
    $result = $update->execute();
    
    if (!$result) {
        throw new Exception("Database Update Error: " . $database->lastErrorMsg());
    }
}

function applyRenameRules($filename, $rules) {
    $expressions = preg_split('/\r?\n/', $rules);
    
    // Separate filename and extension
    $pathInfo = pathinfo($filename);
    $base = $pathInfo['filename'];
    $extension = isset($pathInfo['extension']) ? '.' . $pathInfo['extension'] : '';

    foreach ($expressions as $expr) {
        $expr = trim($expr);
        if ($expr === '') {
            continue;
        }

        $pattern = $expr;
        $replacement = '';
        if (strpos($expr, '||') !== false) {
            list($pattern, $replacement) = explode('||', $expr, 2);
        }

        $result = @preg_replace($pattern, $replacement, $base);
        if ($result === null || preg_last_error() !== PREG_NO_ERROR) {
            return ['filename' => $filename, 'error' => "Invalid rename regex: $pattern"];
        }

        $base = $result;
    }

    return ['filename' => trim($base) . $extension, 'error' => null];
}

function sanitizeShellInput($input) {
    $pattern = '/^[\w\s\-\/\.=:]+$/';
    return preg_match($pattern, $input) ? $input : '';
}

?>
