<?php

// Database connection
$database = new SQLite3('db.sqlite');

// Get profiles
if (isset($_GET['get_profiles'])) {
    header('Content-Type: application/json');
    $profiles_req = $database->prepare('SELECT * FROM profiles ORDER BY reorder ASC;');
    $profiles_result = $profiles_req->execute();
    $profiles = [];
    while ($profile = $profiles_result->fetchArray(SQLITE3_ASSOC)) {
        $profiles[] = $profile;
    }
    echo json_encode($profiles);
    exit();
}

// Add profile
if (isset($_POST['add_profile'])) {
    header('Content-Type: application/json');
    $database->exec("INSERT INTO profiles (reorder, name, destination, container, max_res, min_res) VALUES (0, '', '', 'mkv', '', '')");
    echo json_encode(['status' => 'success']);
    exit();
}

// Reset profiles
if (isset($_POST['reset_profiles'])) {
    header('Content-Type: application/json');
    try {
        $database->exec("DELETE FROM profiles");
        // Add initial profiles
        $default_profiles = [
            "INSERT OR IGNORE INTO profiles (id, reorder, command_line, name, destination, container, max_res, min_res, audio, video, cache) VALUES (1, '1', '-w --encoding UTF-8 --no-progress', 'video-highest (4K)', '%(title)s.%(ext)s', 'mkv', NULL, '1080', 'bestaudio', 'bestvideo', '--cache-dir /var/www/html/youtube2/cache/')",
            "INSERT OR IGNORE INTO profiles (id, reorder, command_line, name, destination, container, max_res, min_res, audio, video, cache) VALUES (2, '2', '-w --encoding UTF-8 --no-progress', 'video-1080p (1080P)', '%(title)s.%(ext)s', 'mkv', '1080', NULL, 'bestaudio', 'bestvideo', '--cache-dir /var/www/html/youtube2/cache/')",
            "INSERT OR IGNORE INTO profiles (id, reorder, command_line, name, destination, container, max_res, min_res, audio, video, cache) VALUES (3, '3', '-w --encoding UTF-8 --no-progress', 'SD', '%(title)s.%(ext)s', 'mkv', '480', NULL, 'bestaudio', 'bestvideo', '--cache-dir /var/www/html/youtube2/cache/')",
            "INSERT OR IGNORE INTO profiles (id, reorder, command_line, name, destination, container, max_res, min_res, audio, video, cache) VALUES (4, '4', '-w --encoding UTF-8 --no-progress', 'video-1440p (1440P)', '%(title)s.%(ext)s', 'mkv', '1440', NULL, 'bestaudio', 'bestvideo', '--cache-dir /var/www/html/youtube2/cache/')"
        ];
        foreach ($default_profiles as $profile) {
            $database->exec($profile);
        }
        echo json_encode(['status' => 'success']);
    } catch (Exception $e) {
        echo json_encode(['status' => 'error', 'message' => $e->getMessage()]);
    }
    exit();
}

// Update profiles
if (isset($_POST['update_profiles'])) {
    header('Content-Type: application/json');
    try {
        $profiles = $_POST['profiles'];
        foreach ($profiles as $profile) {
            $id = $database->escapeString($profile['id']);
            $name = $database->escapeString($profile['name']);
            $container = $database->escapeString($profile['container']);
            $max_res = $database->escapeString($profile['max_res']);
            $min_res = $database->escapeString($profile['min_res']);
            $database->exec("UPDATE profiles SET name='$name', container='$container', max_res='$max_res', min_res='$min_res' WHERE id=$id");
        }
        echo json_encode(['status' => 'success']);
    } catch (Exception $e) {
        echo json_encode(['status' => 'error', 'message' => $e->getMessage()]);
    }
    exit();
}

// Reorder profiles
if (isset($_POST['reorder_profiles'])) {
    header('Content-Type: application/json');
    try {
        $profiles = $_POST['profiles'];
        foreach ($profiles as $profile) {
            $id = $database->escapeString($profile['id']);
            $reorder = $database->escapeString($profile['reorder']);
            $database->exec("UPDATE profiles SET reorder=$reorder WHERE id=$id");
        }
        echo json_encode(['status' => 'success']);
    } catch (Exception $e) {
        echo json_encode(['status' => 'error', 'message' => $e->getMessage()]);
    }
    exit();
}

// Delete profile
if (isset($_POST['delete_profile'])) {
    header('Content-Type: application/json');
    try {
        $id = $database->escapeString($_POST['id']);
        $database->exec("DELETE FROM profiles WHERE id=$id");
        echo json_encode(['status' => 'success']);
    } catch (Exception $e) {
        echo json_encode(['status' => 'error', 'message' => $e->getMessage()]);
    }
    exit();
}
?>
