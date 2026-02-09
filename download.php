<?php
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

const LOCALE = 'fr_FR.UTF-8';

require_once 'functions.php';

set_time_limit(4000);
setlocale(LC_ALL, LOCALE);
putenv('LC_ALL=' . LOCALE);

if (isset($_POST["url"])) {
    if (!verifyCsrfHeader() && (!isset($_POST['csrf_token']) || !verifyCsrfToken($_POST['csrf_token']))) {
        error_log("CSRF Failure in download.php. Header token: " . ($_SERVER['HTTP_X_CSRF_TOKEN'] ?? 'missing') . " | Post token: " . ($_POST['csrf_token'] ?? 'missing') . " | Session token: " . ($_SESSION['csrf_token'] ?? 'missing') . PHP_EOL, 3, LOG_FILE);
        echo json_encode(['error' => 'Invalid CSRF token']);
        exit();
    }
    $database = initializeDatabase();

    // Ensure URL includes the protocol
    $url = $_POST["url"];
    if (!preg_match('/^https?:\/\//', $url)) {
        $url = 'http://' . $url;
    }

    // Extract video ID from URL
    preg_match('#(?<=(?:v|i)=)[a-zA-Z0-9-]+(?=&)|(?<=(?:v|i)\/)[^&\n]+|(?<=embed\/)[^"&\n]+|(?<=(?:v|i)=)[^&\n]+|(?<=youtu.be\/)[^&\n]+#', $url, $video_id);
    if (empty($video_id)) {
        echo json_encode(['error' => 'Invalid URL']);
        exit();
    }

    $pid = $_POST["id"];

    // Fetch profile settings
    $profile = fetchProfile($database, $pid);
    if (!$profile) {
        echo json_encode(['error' => 'Profile not found']);
        exit();
    }

    $profile_command = sanitizeShellInput($profile['command_line']);
    $profile_cache   = sanitizeShellInput($profile['cache']);

    // Fetch global options
    $options = fetchOptions($database);
    if (empty($options['download_dir'])) {
        echo json_encode(['error' => 'Download directory not set']);
        exit();
    }
    $options_rename_regex = $options['rename_regex'] ?? '';

    $options_subtitles = $options['subtitles'] ?? 0;
    $options_sub_lang = $options['sub_lang'] ?? 'en'; // Default to 'en' if not set

    // Determine video quality
    $quality = determineQuality($profile);

    $temp_filename = $options['download_dir'] . '/' . $profile['destination'];
    $dest_path = isset($profile['dest_path']) ? rtrim($profile['dest_path'], '/') : '';

    // Final filename
    $get_filename_command = 'yt-dlp --js-runtimes node:/usr/bin/node --remote-components ejs:github ' . escapeshellarg($url) . ' --get-filename -o ' . escapeshellarg($temp_filename) . ' --merge-output-format ' . $profile['container'] . ' ' . $profile_command . ' ' . $profile_cache;
    $filename = executeCommand($get_filename_command);

    if (!isset($filename[0]) || strpos($filename[0], "WARNING") === 0) {
        echo json_encode(['error' => 'Failed to retrieve filename']);
        exit();
    }

    $final_filename = $filename[0];
    $filesql = SQLite3::escapeString($final_filename);

    // Construct the download command based on subtitle options
    $download_command = 'yt-dlp --js-runtimes node:/usr/bin/node --remote-components ejs:github ' . escapeshellarg($url) . ' --ignore-config ' . $profile_command;

    if ($options_subtitles == 1) {
        // Add subtitle options for external subtitles
        $download_command .= ' --write-sub --write-auto-sub --sub-lang ' . $options_sub_lang . '.* --convert-subs srt';
    } elseif ($options_subtitles == 2) {
        // Add subtitle options for embedded subtitles
        $download_command .= ' --write-subs --write-auto-subs --embed-subs --compat-options no-keep-subs --sub-lang ' . $options_sub_lang . '.*';
    }

    $download_command .= ' -o ' . escapeshellarg($final_filename) . ' --merge-output-format ' . $profile['container'] . ' ' . $profile_cache . ' ' . $quality;

    $dest_path = isset($profile['dest_path']) ? rtrim($profile['dest_path'], '/') : '';

    // Insert download record into queue with the command
    $temprowid = insertIntoQueue($database, $video_id[0], $final_filename, $download_command, $dest_path);

    // Launch the worker in background
    exec('php ' . __DIR__ . '/worker.php > /dev/null 2>&1 &');

    // Respond immediately to the client
    echo json_encode(['id' => $temprowid, 'status' => 'queued']);

    $database->close();
}
?>
