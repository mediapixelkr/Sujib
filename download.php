<?php
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

const LOCALE = 'fr_FR.UTF-8';

require 'functions.php';

set_time_limit(4000);
setlocale(LC_ALL, LOCALE);
putenv('LC_ALL=' . LOCALE);

if (isset($_POST["url"])) {
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
    $get_filename_command = 'yt-dlp ' . escapeshellarg($url) . ' --get-filename -o ' . escapeshellarg($temp_filename) . ' --merge-output-format ' . $profile['container'] . ' ' . $profile_command . ' ' . $profile_cache;
    $filename = executeCommand($get_filename_command);

    if (!isset($filename[0]) || strpos($filename[0], "WARNING") === 0) {
        echo json_encode(['error' => 'Failed to retrieve filename']);
        exit();
    }

    $final_filename = $filename[0];
    $filesql = SQLite3::escapeString($final_filename);

    // Insert download record into queue
    $temprowid = insertIntoQueue($database, $video_id[0], $filesql);

    // Construct the download command based on subtitle options
    $download_command = 'yt-dlp ' . escapeshellarg($url) . ' --ignore-config --prefer-ffmpeg ' . $profile_command;

    if ($options_subtitles == 1) {
        // Add subtitle options for external subtitles
        $download_command .= ' --write-sub --write-auto-sub --sub-lang ' . $options_sub_lang . '.* --convert-subs srt';
    } elseif ($options_subtitles == 2) {
        // Add subtitle options for embedded subtitles
        $download_command .= ' --write-subs --write-auto-subs --embed-subs --compat-options no-keep-subs --sub-lang ' . $options_sub_lang . '.*';
    }

    $download_command .= ' -o ' . escapeshellarg($final_filename) . ' --merge-output-format ' . $profile['container'] . ' ' . $profile_cache . ' ' . $quality . ' --quiet';

    // Log the command
    //error_log("Download command: " . $download_command);

    // Execute the download command
    exec($download_command . ' 2>&1', $output, $return_var);

    // Log the output
    //error_log("Download output: " . implode("\n", $output));

    // Verify the file existence
    if (file_exists($final_filename)) {
        if (!empty($options_rename_regex)) {
            $dir = dirname($final_filename);
            $rename = applyRenameRules(basename($final_filename), $options_rename_regex);

            $base = $rename['filename'];
            if ($rename['error'] === null && $base !== basename($final_filename)) {
                $newPath = $dir . '/' . $base;
                if (@rename($final_filename, $newPath)) {
                    $final_filename = $newPath;
                }
            }
        }

        if (!empty($dest_path)) {
            if (!is_dir($dest_path)) {
                @mkdir($dest_path, 0777, true);
            }
            $moved = rtrim($dest_path, '/') . '/' . basename($final_filename);
            if (@rename($final_filename, $moved)) {
                $final_filename = $moved;
            }
        }
        // Fetch media info
        $mediainfo = fetchMediaInfo($final_filename);
        
        // Insert download record into downloaded table
        $date = date("F d Y H:i:s", filemtime($final_filename));
        $rowid = insertIntoDownloaded($database, $video_id[0], $mediainfo, $final_filename, $date, $temprowid);

        // Remove from queue
        removeFromQueue($database, $temprowid);

        // Prepare response
        $table = createTable(basename($final_filename), $mediainfo, $date);
        $response = ['id' => $rowid, 'table' => $table];
        echo json_encode($response);
    } else {
        $errorMsg = trim(implode("\n", $output));
        if ($errorMsg === '') {
            $errorMsg = 'Download failed';
        }
        echo json_encode(['error' => $errorMsg]);
    }

    $database->close();
}
?>
