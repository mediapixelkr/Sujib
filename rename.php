<?php
set_time_limit(4000);
$locale='fr_FR.UTF-8';
setlocale(LC_ALL, $locale);
putenv('LC_ALL='.$locale);

include_once 'functions.php';

// Main logic
if (isset($_GET["id"])) {
    $id = stripslashes(SQLite3::escapeString($_GET["id"]));
    $database = connectDatabase();
    $result = fetchRecordById($database, $id);

    if (isset($_POST["name"])) {
        $newName = $_POST["name"];
        handleRenameRequest($id, $newName);
    } else {
        while ($val = $result->fetchArray()) {
            if (file_exists($val['filename'])) {
                renderRenameForm($id, $val['filename']);
            } else {
                renderFileNotFound($val['filename']);
            }
        }
    }

    $database->close();
}
?>
