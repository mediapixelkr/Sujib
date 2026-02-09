<?php
require_once 'functions.php';

if (isset($_POST['id'])) {
    if (!verifyCsrfHeader() && (!isset($_POST['csrf_token']) || !verifyCsrfToken($_POST['csrf_token']))) {
        error_log("CSRF Failure in terminate.php. Header token: " . ($_SERVER['HTTP_X_CSRF_TOKEN'] ?? 'missing') . " | Post token: " . ($_POST['csrf_token'] ?? 'missing') . " | Session token: " . ($_SESSION['csrf_token'] ?? 'missing') . PHP_EOL, 3, LOG_FILE);
        echo json_encode(['status' => 'error', 'message' => 'Invalid CSRF token']);
        exit();
    }
    $id = (int)$_POST['id'];
    $database = connectDatabase();
    
    if (terminateDownload($database, $id)) {
        echo json_encode(['status' => 'terminated']);
    } else {
        echo json_encode(['status' => 'error', 'message' => 'Job not found']);
    }
    
    $database->close();
}
?>
