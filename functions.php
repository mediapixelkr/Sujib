<?php

// Custom error and exception handling functions
function handleException($exception) {
    //error_log("Exception: " . $exception->getMessage());
    echo json_encode(['error' => 'An error occurred. Please try again later.']);
    exit();
}

function handleError($errno, $errstr, $errfile, $errline) {
    //error_log("Error: [$errno] $errstr - $errfile:$errline");
    echo json_encode(['error' => 'An error occurred. Please try again later.']);
    exit();
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
    return new SQLite3(DB_PATH);
}

function createTables($database) {
    $tables = [
        'profiles' => "CREATE TABLE IF NOT EXISTS profiles (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            reorder TEXT,
            command_line TEXT,
            name TEXT,
            destination TEXT,
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
            date TEXT
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
            "INSERT INTO profiles (id, reorder, command_line, name, destination, container, max_res, min_res, audio, video, cache) VALUES (1, '1', '-w --encoding UTF-8 --no-progress', 'video-highest (4K)', '$destination', 'mkv', NULL, '1080', 'bestaudio', 'bestvideo', '--cache-dir $cache_dir')",
            "INSERT INTO profiles (id, reorder, command_line, name, destination, container, max_res, min_res, audio, video, cache) VALUES (2, '2', '-w --encoding UTF-8 --no-progress', 'video-1080p (1080P)', '$destination', 'mkv', '1080', NULL, 'bestaudio', 'bestvideo', '--cache-dir $cache_dir')",
            "INSERT INTO profiles (id, reorder, command_line, name, destination, container, max_res, min_res, audio, video, cache) VALUES (4, '4', '-w --encoding UTF-8 --no-progress', 'video-1440p (1440P)', '$destination', 'mkv', '1440', NULL, 'bestaudio', 'bestvideo', '--cache-dir $cache_dir')",
            "INSERT INTO profiles (id, reorder, command_line, name, destination, container, max_res, min_res, audio, video, cache) VALUES (5, '5', '-w --encoding UTF-8 --no-progress', 'video-720p (720P)', '$destination', 'mkv', '720', NULL, 'bestaudio', 'bestvideo', '--cache-dir $cache_dir')"
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

function insertIntoQueue($database, $video_id, $filesql) {
    $database->exec("INSERT INTO 'queue' ('video_id', 'wait', 'filename', 'size', 'date') VALUES ('$video_id', '0', '$filesql', '', '')");
    return $database->lastInsertRowid();
}

function fetchMediaInfo($file_dl) {
    $mediainfo_cmds = [
        'resolution' => 'mediainfo "' . $file_dl . '" --Inform="Video;%Width%x%Height%"',
        'codec' => 'mediainfo "' . $file_dl . '" --Inform="Video;%CodecID%"',
        'size' => 'mediainfo "' . $file_dl . '" --Inform="General;%FileSize/String1%"',
        'codec_audio' => 'mediainfo "' . $file_dl . '" --Inform="Audio;%CodecID%"',
        'bitrate' => 'mediainfo "' . $file_dl . '" --Inform="Video;%BitRate/String%"',
        'bitrate_audio' => 'mediainfo "' . $file_dl . '" --Inform="Audio;%BitRate/String%"',
        'duration' => 'mediainfo "' . $file_dl . '" --Inform="General;%Duration/String2%"',
    ];

    $mediainfo = [];
    foreach ($mediainfo_cmds as $key => $cmd) {
        $output = executeCommand($cmd);
        //error_log("$key output: " . json_encode($output)); // Log output
        $mediainfo[$key] = !empty($output) && !empty($output[0]) ? SQLite3::escapeString($output[0]) : 'N/A';
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
    $database->exec("DELETE FROM queue WHERE id = $temprowid");
}

function createTable($filename, $mediainfo, $date) {
    return '<table>
        <tr><td colspan="4" class="table_title" style="padding-bottom:5px">' . $filename . '</td></tr>
        <tr><td width="50%" colspan="2"><i class="far fa-clock"></i> <b>Duration :</b> ' . $mediainfo['duration'] . '</td>
            <td width="50%" colspan="2"><i class="fas fa-desktop"></i> <b>Resolution :</b> ' . $mediainfo['resolution'] . '</td></tr>
        <tr><td colspan="4">
            <table>
                <tr><td width="50%" colspan="2"><i class="fas fa-film"></i> <b>Video :</b> ' . $mediainfo['codec'] . ' @ ' . $mediainfo['bitrate'] . '</td>
                    <td width="50%" colspan="2"><i class="fas fa-volume-up"></i> <b>Audio :</b> ' . $mediainfo['codec_audio'] . ' @ ' . $mediainfo['bitrate_audio'] . '</td></tr>
            </table>
        </td></tr>
        <tr><td colspan="2"><i class="far fa-calendar"></i> <b>Date :</b> ' . $date . '</td>
            <td colspan="2"><i class="far fa-hdd"></i> <b>Size :</b> ' . $mediainfo['size'] . '</td></tr>
    </table>';
}

function fetchRecordById($database, $id) {
    $select = $database->prepare('SELECT * FROM downloaded WHERE id=:gid');
    $select->bindParam(':gid', $id, SQLITE3_TEXT);
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
    $result = fetchRecordById($database, $id);

    while ($val = $result->fetchArray()) {
        $oldFilename = pathinfo($val['filename']);
        $path = $oldFilename['dirname'];
        $ext = $oldFilename['extension'];
        $newFilename = $path . "/" . stripslashes($newName) . "." . $ext;
        $newFilenameSql = $path . "/" . stripslashes(SQLite3::escapeString($newName)) . "." . $ext;

        if (file_exists($val['filename'])) {
            rename($val['filename'], $newFilename);
            updateFilename($database, $newFilenameSql, $id);
        }

        echo basename($newFilename);
    }

    $database->close();
}

function renderRenameForm($id, $filename) {
    $file = pathinfo($filename);
    $filenameWithoutExt = htmlspecialchars($file['filename'], ENT_QUOTES, 'UTF-8');
    echo '<form id="rename_form" style="margin: 0 auto; border-radius: 5px; display: inline-block;" autocomplete="off">
          <label style="position: relative;">File name : </label>
          <input class="input-link input-name" style="width:35rem" type="text" value="' . $filenameWithoutExt . '">
          </form>
          <button class="submit-rename btn rename" id="' . $id . '">
          <i class="fas fa-edit fa-sm"></i> Rename</button>
          <button class="submit-rename-close btn link">
          <i class="fas fa-window-close fa-sm"></i> Cancel</button>
          <script type="text/javascript">
          $(".submit-rename").click(function(e) {
              e.preventDefault();
              var renid = $(this).attr(\'id\');
              $.post("rename.php?id=" + renid, {name: $(\'.input-name\').val()}, function(status) {
                  $(\'.tabs #\' + renid + \' .table_title\').html(status);
                  $.modal.close();
              });
          });
          $(".submit-rename-close").click(function(e) {
              e.preventDefault();
              $.modal.close();
          });
          </script>';
}

function renderFileNotFound($filename) {
    $file = pathinfo($filename);
    echo "<span style=\"position: relative; max-width: 57em !important; margin-right: 4em;\">Can't find the file: <b>" . htmlspecialchars($file['filename'], ENT_QUOTES, 'UTF-8') . '.' . htmlspecialchars($file['extension'], ENT_QUOTES, 'UTF-8') . "<b></span>";
    echo '<button class="submit-rename-close btn link">
          <i class="fas fa-window-close fa-sm"></i> Close</button>
          <script type="text/javascript">
          $(".submit-rename-close").click(function(e) {
              e.preventDefault();
              $.modal.close();
          });
          </script>';
}

function handleQueueRequest($id) {
    $database = connectDatabase();
    $result = fetchRecordById($database, $id);
    $check = $result->fetchArray();

    if (!$check) {
        $result2 = fetchRecordById($database, $id);

        while ($val2 = $result2->fetchArray()) {
            if (file_exists($val2['filename'])) {
                $table = generateFileTable($val2);
                $arr = ['id' => $val2['id'], 'table' => $table];
                echo json_encode($arr);
            }
        }
    } else {
        echo json_encode('downloading');
    }

    $database->close();
}

function generateFileTable($fileInfo) {
    $file = pathinfo($fileInfo['filename']);
    $filename = htmlspecialchars($file['filename'], ENT_QUOTES, 'UTF-8');
    $extension = htmlspecialchars($file['extension'], ENT_QUOTES, 'UTF-8');
    $duration = htmlspecialchars($fileInfo['duration'], ENT_QUOTES, 'UTF-8');
    $resolution = htmlspecialchars($fileInfo['resolution'], ENT_QUOTES, 'UTF-8');
    $codec_v = htmlspecialchars($fileInfo['codec_v'], ENT_QUOTES, 'UTF-8');
    $bitrate_v = htmlspecialchars($fileInfo['bitrate_v'], ENT_QUOTES, 'UTF-8');
    $codec_a = htmlspecialchars($fileInfo['codec_a'], ENT_QUOTES, 'UTF-8');
    $bitrate_a = htmlspecialchars($fileInfo['bitrate_a'], ENT_QUOTES, 'UTF-8');
    $date = htmlspecialchars($fileInfo['date'], ENT_QUOTES, 'UTF-8');
    $size = htmlspecialchars($fileInfo['size'], ENT_QUOTES, 'UTF-8');

    return '
        <table>
            <tr>
                <td colspan="4" class="table_title" style="padding-bottom:5px">' . $filename . '.' . $extension . '</td>
            </tr>
            <tr>
                <td width="50%" colspan="2"><i class="far fa-clock"></i> <b>Duration :</b> ' . $duration . '</td>
                <td width="50%" colspan="2"><i class="fas fa-desktop"></i> <b>Resolution :</b> ' . $resolution . '</td>
            </tr>
            <tr>
                <td colspan="4">
                    <table>
                        <tr>
                            <td width="50%" colspan="2"><i class="fas fa-film"></i> <b>Video :</b> ' . $codec_v . ' @ ' . $bitrate_v . '</td>
                            <td width="50%" colspan="2"><i class="fas fa-volume-up"></i> <b>Audio :</b> ' . $codec_a . ' @ ' . $bitrate_a . '</td>
                        </tr>
                    </table>
                </td>
            </tr>
            <tr>
                <td colspan="2"><i class="far fa-calendar"></i> <b>Date :</b> ' . $date . '</td>
                <td colspan="2"><i class="far fa-hdd"></i> <b>Size :</b> ' . $size . '</td>
            </tr>
        </table>';
}

function deleteFile($database, $id) {
    $select = $database->prepare('SELECT * FROM downloaded WHERE id=:id');
    $select->bindParam(':id', $id, SQLITE3_TEXT);
    $result = $select->execute();

    while ($val = $result->fetchArray()) {
        if (file_exists($val['filename'])) {
            unlink($val['filename']);
        }
        $delete = $database->prepare('DELETE FROM downloaded WHERE id=:id');
        $delete->bindParam(':id', $id, SQLITE3_TEXT);
        $delete->execute();
        echo 'done';
    }
}

function generateDeleteForm($filename, $extension, $id) {
    $truncatedFilename = truncate($filename);
    return '
    <form id="delete_form" style="margin: 0 auto; border-radius: 5px; display: inline-block; max-width: 55em !important; margin-right: 4em;" autocomplete="off">
        <span style="position: relative;">Delete file "<b>' . htmlspecialchars($truncatedFilename) . '.' . htmlspecialchars($extension) . '</b>" from disk?</span>
    </form>
    <button class="submit-delete btn delete" id="' . htmlspecialchars($id) . '"><i class="fas fa-trash-alt fa-sm"></i> Delete</button>
    <button class="submit-delete-close btn link"><i class="fas fa-window-close fa-sm"></i> Cancel</button>
    <script type="text/javascript">
        $(".submit-delete").click(function(e) {
            e.preventDefault();
            var delid = $(this).attr(\'id\');
            $.post("delete.php?id=" + delid, { file: true }, function(status) {
                if (status == \'done\') {
                    $(\'.tabs #\' + delid).remove();
                    $.modal.close();
                    location.reload();
                }
            });
        });

        $(".submit-delete-close").click(function(e) {
            e.preventDefault();
            $.modal.close();
        });
    </script>';
}

function handleFileNotFound($filename, $extension) {
    $truncatedFilename = truncate($filename);
    return "<span style=\"position: relative; max-width: 57em !important; margin-right: 4em;\">Can't find the file: <b>" . htmlspecialchars($truncatedFilename) . '.' . htmlspecialchars($extension) . "<b></span>
    <button class=\"submit-rename-close btn link\"><i class=\"fas fa-window-close fa-sm\"></i> Close</button>
    <script type=\"text/javascript\">
        $(\".submit-rename-close\").click(function(e) {
            e.preventDefault();
            $.modal.close();
        });
    </script>";
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
    $base = $filename;
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

    return ['filename' => $base, 'error' => null];
}

function sanitizeShellInput($input) {
    $pattern = '/^[\w\s\-\/\.=:]+$/';
    return preg_match($pattern, $input) ? $input : '';
}

?>
