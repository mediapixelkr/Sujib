<?php

$database = new SQLite3('db.sqlite');

if (isset($_GET["submit"])) {
    header('Content-Type: application/json');

    try {
        if (isset($_POST["showlast"])) {
            $showlast = (int)$_POST["showlast"];
            $stmt = $database->prepare('UPDATE options SET show_last = :show_last');
            $stmt->bindValue(':show_last', $showlast, SQLITE3_INTEGER);
            $stmt->execute();
        }

        if (isset($_POST["subtitles"])) {
            $subtitles = (int)$_POST["subtitles"];
            $stmt = $database->prepare('UPDATE options SET subtitles = :subtitles');
            $stmt->bindValue(':subtitles', $subtitles, SQLITE3_INTEGER);
            $stmt->execute();
        }

        if (isset($_POST["sub_lang"])) {
            $sub_lang = substr($_POST["sub_lang"], 0, 2); // Ensure it's at most 2 characters
            $stmt = $database->prepare('UPDATE options SET sub_lang = :sub_lang');
            $stmt->bindValue(':sub_lang', $sub_lang, SQLITE3_TEXT);
            $stmt->execute();
        }

        // Respond with a success message
        echo json_encode(['status' => 'success']);
    } catch (Exception $e) {
        // Respond with an error message
        echo json_encode(['status' => 'error', 'message' => $e->getMessage()]);
    }
    exit();
}

if (isset($_GET["cache"])) {
    exec('yt-dlp --rm-cache-dir');
    echo "Cache is now empty !";
    exit();
}

if (isset($_GET['get_profiles'])) {
    $profiles_req = $database->prepare('SELECT * FROM profiles ORDER BY reorder ASC;');
    $profiles_result = $profiles_req->execute();
    while ($profile = $profiles_result->fetchArray(SQLITE3_ASSOC)) {
        echo '<div class="profile-item" data-id="'.$profile['id'].'">';
        echo '<input type="hidden" class="profile-input" name="id" value="'.$profile['id'].'" />';
        echo '<input type="text" class="profile-input" name="name" value="'.htmlspecialchars($profile['name']).'" />';
        echo '<input type="text" class="profile-input" name="destination" value="'.htmlspecialchars($profile['destination']).'" />';
        echo '<select class="select2 profile-input" name="container">';
        echo '<option value="mkv" '.($profile['container'] == 'mkv' ? 'selected' : '').'>MKV</option>';
        echo '<option value="mp4" '.($profile['container'] == 'mp4' ? 'selected' : '').'>MP4</option>';
        echo '</select>';
        echo '<input type="text" class="profile-input" name="max_res" value="'.htmlspecialchars($profile['max_res']).'" />';
        echo '<input type="text" class="profile-input" name="min_res" value="'.htmlspecialchars($profile['min_res']).'" />';
        echo '</div>';
    }
    exit();
}

if (isset($_GET['add_profile'])) {
    $database->exec("INSERT INTO profiles (reorder, name, destination, container, max_res, min_res) VALUES (0, '', '', 'mkv', '', '')");
    exit();
}

if (isset($_GET['reset_profiles'])) {
    $database->exec("DELETE FROM profiles");
    exit();
}

if (isset($_GET['update_profile'])) {
    $id = (int)$_POST['id'];
    $name = $_POST['name'];
    $destination = $_POST['destination'];
    $container = $_POST['container'];
    $max_res = $_POST['max_res'];
    $min_res = $_POST['min_res'];

    $stmt = $database->prepare('UPDATE profiles SET name = :name, destination = :destination, container = :container, max_res = :max_res, min_res = :min_res WHERE id = :id');
    $stmt->bindValue(':name', $name, SQLITE3_TEXT);
    $stmt->bindValue(':destination', $destination, SQLITE3_TEXT);
    $stmt->bindValue(':container', $container, SQLITE3_TEXT);
    $stmt->bindValue(':max_res', $max_res, SQLITE3_TEXT);
    $stmt->bindValue(':min_res', $min_res, SQLITE3_TEXT);
    $stmt->bindValue(':id', $id, SQLITE3_INTEGER);
    $stmt->execute();
    exit();
}

?>
