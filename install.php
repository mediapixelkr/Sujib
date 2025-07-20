<?php
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

function customError($errno, $errstr, $errfile, $errline) {
    echo "<b>Error:</b> [$errno] $errstr - $errfile:$errline<br>";
    echo "Terminating PHP Script<br>";
    die();
}

set_error_handler("customError");

function customException($exception) {
    echo "<b>Exception:</b> " . $exception->getMessage() . "<br>";
    die();
}

set_exception_handler('customException');

$showNav = false;
require_once 'functions.php';

$script_path = realpath(dirname(__FILE__));

if ($_SERVER['REQUEST_METHOD'] == 'POST') {
    $container = $_POST['container'];
    $download_dir = rtrim($_POST['download_dir'], '/'); // Remove trailing slash
    $rename_regex = isset($_POST['rename_regex']) ? $_POST['rename_regex'] : '';
    $show_last = $_POST['show_last'] === 'none' ? 0 : (int)$_POST['show_last'];
    $subtitles = (int)$_POST['subtitles'];
    $sub_lang = substr($_POST['sub_lang'], 0, 2); // Limit to two characters

    // Initialize the database
    $database = initializeDatabase();

    // Update the options table with the selected values
    $update_options_query = "UPDATE options SET download_dir = '$download_dir', rename_regex = '" . SQLite3::escapeString($rename_regex) . "', show_last = $show_last, subtitles = $subtitles, sub_lang = '$sub_lang' WHERE id = 1";
    if (!$database->exec($update_options_query)) {
        throw new Exception("Error updating options: " . $database->lastErrorMsg());
    }

    // Update the profiles table with the selected container and download_dir as destination_dir
    $destination = '%(title)s.%(ext)s';
    $update_profiles_query = [
        "UPDATE profiles SET container = '$container', destination = '$destination' WHERE id IN (1, 2, 3, 4, 5)"
    ];
    foreach ($update_profiles_query as $query) {
        if (!$database->exec($query)) {
            throw new Exception("Error updating profiles: " . $database->lastErrorMsg());
        }
    }

    // Redirect to index.php after successful initialization
    header("Location: index.php");
    exit();
}

require_once 'header.php';
?>

<main class="install-main">
    <div class="content-blue">
        <h1>Installation</h1>
        <form method="POST" class="install-form">
            <div class="form-group">
                <label for="container">Select Container Format:</label><br>
                <select name="container" id="container" class="quality-select form-control">
                    <option value="mkv">MKV</option>
                    <option value="mp4">MP4</option>
                </select>
            </div><br>
            <div class="form-group">
                <label for="download_dir">Base Download Directory (must already exist, max 255 characters):</label><br>
                <input type="text" name="download_dir" id="download_dir" value="<?php echo $script_path; ?>" maxlength="255" required class="form-control">
            </div><br>
            <div class="form-group">
                <label for="rename_regex">Rename Regex (pattern||replacement, optional):</label><br>
                <input type="text" name="rename_regex" id="rename_regex" value="" class="form-control" placeholder="/pattern/||replacement">
            </div><br>
            <div class="form-group">
                <label for="show_last">Number of Last Downloads to Display:</label><br>
                <select name="show_last" id="show_last" class="quality-select form-control">
                    <option value="50">50</option>
                    <option value="20" selected>20</option>
                    <option value="10">10</option>
                    <option value="5">5</option>
                    <option value="3">3</option>
                    <option value="1">1</option>
                    <option value="none">none</option>
                </select>
            </div><br>
            <div class="form-group">
                <label for="subtitles">Subtitles:</label><br>
                <select name="subtitles" id="subtitles" class="quality-select form-control">
                    <option value="0" selected>None</option>
                    <option value="1">External .srt file</option>
                    <option value="2">Embed</option>
                </select>
            </div><br>
            <div class="form-group">
                <label for="sub_lang">Subtitle Language (2 letters):</label><br>
                <input type="text" name="sub_lang" id="sub_lang" value="en" maxlength="2" required class="form-control">
            </div><br>
            <input type="submit" value="Create Database" class="btn btn-primary form-control submit-button">
        </form>
    </div>
</main>
<script>
    $(document).ready(function() {
        $('.quality-select').select2({
            theme: 'flat',
            minimumResultsForSearch: Infinity,
            width: 'resolve' // ensures Select2 dropdown matches input width
        });
    });
</script>
</body>
</html>
