<?php

// Redirect to install.php if the database does not exist
if (!file_exists('db.sqlite')) {
    header("Location: install.php");
    exit();
}

// Database connection
$database = new SQLite3('db.sqlite');

if (isset($_GET["submit"])) {
    header('Content-Type: application/json');

    try {
        if (isset($_POST["showlast"])) {
            $showlast = (int)$_POST["showlast"];
            $database->exec("UPDATE options SET show_last=$showlast");
        }

        if (isset($_POST["subtitles"])) {
            $subtitles = (int)$_POST["subtitles"];
            $database->exec("UPDATE options SET subtitles=$subtitles");
        }

        if (isset($_POST["sub_lang"])) {
            $sub_lang = substr($_POST["sub_lang"], 0, 2); // Ensure it's at most 2 characters
            $database->exec("UPDATE options SET sub_lang='$sub_lang'");
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
    // Add initial profiles if necessary
    exit();
}

if (isset($_GET['update_profile'])) {
    $id = (int)$_POST['id'];
    $name = $database->escapeString($_POST['name']);
    $destination = $database->escapeString($_POST['destination']);
    $container = $database->escapeString($_POST['container']);
    $max_res = $database->escapeString($_POST['max_res']);
    $min_res = $database->escapeString($_POST['min_res']);
    $database->exec("UPDATE profiles SET name='$name', destination='$destination', container='$container', max_res='$max_res', min_res='$min_res' WHERE id=$id");
    exit();
}

?>
