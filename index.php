<?php 
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

require_once 'functions.php';

// Redirect to install.php if the database does not exist
if (!file_exists(DB_PATH)) {
  header("Location: install.php");
  exit();
}

// Initialize database
$database = initializeDatabase();

// Fetch options
$options = fetchOptions($database);

// Fetch profiles
$profiles_req = $database->prepare('SELECT * FROM profiles ORDER BY reorder ASC');
$profiles_result = $profiles_req->execute();
$profiles = [];
while ($p = $profiles_result->fetchArray(SQLITE3_ASSOC)) {
    $profiles[] = $p;
}

// Fetch current queue
$queue_req = $database->prepare('SELECT * FROM queue ORDER BY id DESC');
$queue_result = $queue_req->execute();
$queueItems = [];
while ($q = $queue_result->fetchArray(SQLITE3_ASSOC)) {
    $queueItems[] = $q;
}

// Fetch recently downloaded
$last_req = $database->prepare('SELECT * FROM downloaded ORDER BY id DESC LIMIT :nbr');
$last_req->bindValue(':nbr', $options['show_last'], SQLITE3_INTEGER);
$last_result = $last_req->execute();
$downloadedItems = [];
while ($d = $last_result->fetchArray(SQLITE3_ASSOC)) {
    $downloadedItems[] = $d;
}

$showNav = true;
require_once 'header.php';

echo '<main>';

// Render main content
echo render('index', [
    'profiles' => $profiles,
    'queueItems' => $queueItems,
    'downloadedItems' => $downloadedItems
]);

// Render modals
echo render('options_modal', ['options' => $options]);
echo render('profiles_modal', ['profiles' => $profiles]);
echo render('playlist_modal');

?>
<!-- Rename Modal -->
<div id="rename-form" class="modal"></div>

<!-- Delete Modal -->
<div id="delete-form" class="modal"></div>

<script src="js/script.js"></script>
</main>

<footer>
    <div class="footer">Copyright M. SERAPHIN - mediapixel.kr 2018-2025</div>
</footer>
</body>
</html>