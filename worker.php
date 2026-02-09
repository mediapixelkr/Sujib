<?php
require_once 'functions.php';

$lockFile = sys_get_temp_dir() . '/sujib_worker.lock';
$fp = fopen($lockFile, 'w');
if (!flock($fp, LOCK_EX | LOCK_NB)) {
    exit();
}

$database = connectDatabase();

while (true) {
    $result = $database->query("SELECT * FROM queue ORDER BY id ASC LIMIT 1");
    $job = $result->fetchArray(SQLITE3_ASSOC);

    if (!$job) break;

    $id = $job['id'];
    $video_id = $job['video_id'];
    $final_filename = $job['filename'];
    $command = $job['command'];
    $dest_path_profile = $job['dest_path'];

    error_log("Worker starting job $id for video $video_id", 3, LOG_FILE);

    if (empty($command)) {
        $stmt = $database->prepare("DELETE FROM queue WHERE id = :id");
        $stmt->bindValue(':id', $id, SQLITE3_INTEGER);
        $stmt->execute();
        continue;
    }

    $descriptorspec = [
        0 => ["pipe", "r"],
        1 => ["pipe", "w"],
        2 => ["pipe", "w"]
    ];

    // Ensure we get progress output
    $command .= " --newline --progress";
    
    $process = proc_open($command, $descriptorspec, $pipes);

    if (is_resource($process)) {
        $status = proc_get_status($process);
        $pid = $status['pid'];
        
        $stmt = $database->prepare("UPDATE queue SET pid = :pid WHERE id = :id");
        $stmt->bindValue(':pid', $pid, SQLITE3_INTEGER);
        $stmt->bindValue(':id', $id, SQLITE3_INTEGER);
        $stmt->execute();

        while ($line = fgets($pipes[1])) {
            // Log a sample of output if needed for debugging
            // error_log("yt-dlp output: " . $line, 3, LOG_FILE);

            // yt-dlp typical progress line: [download]  45.2% of 10.00MiB at 1.20MiB/s ETA 00:05
            if (preg_match('/(\d+(\.\d+)?)%/', $line, $matches)) {
                $progress = $matches[1] . '%';
                $stmt = $database->prepare("UPDATE queue SET progress = :p WHERE id = :id");
                $stmt->bindValue(':p', $progress, SQLITE3_TEXT);
                $stmt->bindValue(':id', $id, SQLITE3_INTEGER);
                $stmt->execute();
            }
        }
        
        $stderr = stream_get_contents($pipes[2]);
        if (!empty($stderr)) {
            error_log("yt-dlp stderr for job $id: " . $stderr, 3, LOG_FILE);
        }

        fclose($pipes[0]);
        fclose($pipes[1]);
        fclose($pipes[2]);
        proc_close($process);
    }

    if (file_exists($final_filename)) {
        error_log("File downloaded successfully: $final_filename", 3, LOG_FILE);
        $options = fetchOptions($database);
        
        // 1. Apply Rename Regex
        if (!empty($options['rename_regex'])) {
            $dir = dirname($final_filename);
            $rename = applyRenameRules(basename($final_filename), $options['rename_regex']);
            if ($rename['error'] === null && $rename['filename'] !== basename($final_filename)) {
                $newPath = $dir . '/' . $rename['filename'];
                if (safeMove($final_filename, $newPath)) {
                    error_log("Renamed to: $newPath", 3, LOG_FILE);
                    $final_filename = $newPath;
                }
            }
        }

        // 2. Move to destination path from profile
        if (!empty($dest_path_profile)) {
            if (!is_dir($dest_path_profile)) {
                @mkdir($dest_path_profile, 0777, true);
            }
            $target = rtrim($dest_path_profile, '/') . '/' . basename($final_filename);
            if (safeMove($final_filename, $target)) {
                error_log("Moved to: $target", 3, LOG_FILE);
                $final_filename = $target;
            }
        }

        $mediainfo = fetchMediaInfo($final_filename);
        $date = date("F d Y H:i:s", filemtime($final_filename));
        insertIntoDownloaded($database, $video_id, $mediainfo, $final_filename, $date, $id);
        removeFromQueue($database, $id);
    } else {
        error_log("Job $id failed: File not found at $final_filename", 3, LOG_FILE);
        removeFromQueue($database, $id);
    }
}

$database->close();
flock($fp, LOCK_UN);
fclose($fp);
unlink($lockFile);