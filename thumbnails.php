<?php
require_once 'functions.php';

if (isset($_POST["url"])) {

    $video_id = extract_video_id($_POST['url']);

    if (!$video_id) {
        error_log("Failed to extract video ID from URL: " . htmlspecialchars($_POST['url']));
        echo json_encode(['error' => 'Invalid URL']);
        exit();
    }

    // Ensure the cache directory exists
    $cache_dir = CACHE_DIR;
    if (!is_dir($cache_dir) && !mkdir($cache_dir, 0777, true)) {
        error_log("Failed to create cache directory at $cache_dir");
        echo json_encode(['error' => 'Failed to create cache directory']);
        exit();
    }

    // Define a function to download and save images
    function download_image($url, $save_to) {
        $ch = curl_init($url);
        curl_setopt($ch, CURLOPT_HEADER, 0);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);
        curl_setopt($ch, CURLOPT_BINARYTRANSFER, 1);
        $raw_data = curl_exec($ch);
        $curl_error = curl_error($ch);
        curl_close($ch);

        if ($raw_data) {
            if (file_put_contents($save_to, $raw_data) === false) {
                error_log("Failed to save image to: " . $save_to);
                return false;
            }
            return true;
        } else {
            error_log("Failed to download image from: " . $url . " Error: " . $curl_error);
            return false;
        }
    }

    // List of thumbnails to download
    $thumbnails = [
        'hqdefault' => "http://img.youtube.com/vi/$video_id/hqdefault.jpg",
        '0' => "http://img.youtube.com/vi/$video_id/0.jpg",
        '1' => "http://img.youtube.com/vi/$video_id/1.jpg",
        '2' => "http://img.youtube.com/vi/$video_id/2.jpg",
        'default' => "http://img.youtube.com/vi/$video_id/default.jpg",
        'sddefault' => "http://img.youtube.com/vi/$video_id/sddefault.jpg",
        'mqdefault' => "http://img.youtube.com/vi/$video_id/mqdefault.jpg",
        // Uncomment to download maxresdefault
        // 'maxresdefault' => "http://img.youtube.com/vi/$video_id/maxresdefault.jpg",
    ];

    $errors = [];
    foreach ($thumbnails as $key => $url) {
        $save_path = rtrim($cache_dir, '/') . "/{$video_id}_{$key}.jpg";
        if (!download_image($url, $save_path)) {
            $errors[] = $key;
        }
    }

    if (empty($errors)) {
       //echo json_encode(['success' => $video_id]);
       echo $video_id;
    } else {
        /*echo json_encode(['error' => 'Failed to download thumbnails', 'details' => $errors]);*/
    }
    exit();
}
?>
