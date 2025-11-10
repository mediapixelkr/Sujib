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

    if (isset($_GET["terminate"]) && $_GET["terminate"] === "true") {
        // Handle termination
        $stmt = $database->prepare("DELETE FROM queue WHERE id = :id");
        $stmt->bindParam(':id', $id, SQLITE3_INTEGER);
        $result = $stmt->execute();
        if ($result) {
            echo json_encode(['status' => 'success', 'message' => 'Download terminated successfully.']);
        } else {
            echo json_encode(['status' => 'error', 'message' => 'Error terminating download: ' . htmlspecialchars($database->lastErrorMsg())]);
        }
        exit;
    } elseif (isset($_POST["file"])) {
        deleteFile($database, $id);
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
