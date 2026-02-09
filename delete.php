<?php
set_time_limit(4000);
$locale = 'fr_FR.UTF-8';
setlocale(LC_ALL, $locale);
putenv('LC_ALL=' . $locale);

include_once 'functions.php';

if (isset($_GET["id"])) {
    // Validate the ID
    $id = filter_input(INPUT_GET, 'id', FILTER_VALIDATE_INT);
    if ($id === false) {
        echo "<div class='error'>Invalid ID.</div>";
        exit();
    }

    $database = connectDatabase();

    if (isset($_POST["file"])) {
        $deleteFromDisk = ($_POST["file"] === 'true');
        deleteFile($database, $id, $deleteFromDisk);
    } else {
        $result = fetchRecordById($database, $id);
    
        while ($val = $result->fetchArray()) {
            $file = pathinfo($val['filename']);
            if (file_exists($val['filename'])) {
                echo generateDeleteForm(htmlspecialchars($file['filename']), htmlspecialchars($file['extension']), $id);
            } else {
                echo handleFileNotFound(htmlspecialchars($file['filename']), htmlspecialchars($file['extension']));
            }
        }
    }
    

    $database->close();
    unset($database);
}
?>
