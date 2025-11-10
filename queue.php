<?php
set_time_limit(4000);
$locale='fr_FR.UTF-8';
setlocale(LC_ALL, $locale);
putenv('LC_ALL='.$locale);

include_once 'functions.php';

// Main logic
if (isset($_POST["id"])) {
    $id = stripslashes(SQLite3::escapeString($_POST["id"]));
    handleQueueRequest($id);
}
?>
