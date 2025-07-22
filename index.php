<?php 
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

require_once 'functions.php';

// Use PHP's default error handling so runtime warnings don't stop page output
set_error_handler(null);
set_exception_handler(null);

// Redirect to install.php if the database does not exist
if (!file_exists(DB_PATH)) {
  header("Location: install.php");
  exit();
}

$showNav = true;
require_once 'header.php';

// Initialize database
$database = initializeDatabase();

// Fetch options from the database
$options = fetchOptions($database);
$options_show_last = $options['show_last'] ?? '';
$options_subtitles = $options['subtitles'] ?? 0;
$options_sub_lang = $options['sub_lang'] ?? 'en'; // Default to 'en' if not set
$options_download_dir = $options['download_dir'] ?? '';
$options_rename_regex = $options['rename_regex'] ?? '';

// Fetch profiles (with error handling)
function fetchProfiles($database) {
    $query = "SELECT id, reorder, command_line, name, destination, dest_path, container, max_res, min_res, audio, video, cache FROM profiles";
    $stmt = $database->prepare($query);
    if (!$stmt) {
        throw new Exception("Error preparing statement: " . $database->lastErrorMsg());
    }
    $result = $stmt->execute();
    if (!$result) {
        throw new Exception("Error executing statement: " . $database->lastErrorMsg());
    }
    $profiles = [];
    while ($row = $result->fetchArray(SQLITE3_ASSOC)) {
        $profiles[] = $row;
    }
    return $profiles;
}

$profiles = [];
try {
    $profiles = fetchProfiles($database);
} catch (Exception $e) {
    echo "<div class='error'>Error fetching profiles: " . $e->getMessage() . "</div>";
}
?>
<main>
<div class="content-pink">
<?php
$locale = 'fr_FR.UTF-8';
setlocale(LC_ALL, $locale);
putenv('LC_ALL=' . $locale);
$footer = "By Mick S. - mediapixel.kr © 2018-2024";

include 'thumbnails.php';

if (isset($_GET["download"])) {
    // Do nothing
} elseif (isset($_GET["add"]) && isset($_POST['link'])) {
    // Do nothing
} elseif (isset($_GET["preview"]) && isset($_POST['link'])) {

    if (isset($_POST['clear'])) {
        $file = fopen("list", "r+");
        if ($file !== false) {
            ftruncate($file, 0);
            fclose($file);
        }
    }
    ?> 
    <div class="table-tvs">Preview YouTube video link</div> 
    <?php
    preg_match('#(?<=(?:v|i)=)[a-zA-Z0-9-]+(?=&)|(?<=(?:v|i)\/)[^&\n]+|(?<=embed\/)[^"&\n]+|(?<=(?:v|i)=)[^&\n]+|(?<=youtu.be\/)[^&\n]+#', $_POST['link'], $video_id);
    cache_img($video_id[0]);
    echo "<img src=\"thumbnail.php?id={$video_id[0]}&type=hqdefault\" /><br>";
    echo "<img src=\"thumbnail.php?id={$video_id[0]}&type=1\" />
    <img src=\"thumbnail.php?id={$video_id[0]}&type=2\" />";
    ?>
    <form id="video_link" action="?add" method="post"> 
        <p><input type="text" name="vid" size="12" value="<?php echo $video_id[0]; ?>" hidden />
        <input type="text" name="link" size="12" value="<?php echo $_POST['link']; ?>" hidden />
       <input type="submit" value="Add to download queue" class="" style="margin-left:12px;" /></p>
    </form>
    <?php
} else {
  echo '<div class="row">';
  
  // Get download profiles from database
  $profiles_req = $database->prepare('SELECT * FROM profiles ORDER BY reorder ASC;');
  $profiles_result = $profiles_req->execute();
  $options = '';
  
  while ($profile = $profiles_result->fetchArray(SQLITE3_ASSOC)) {
      // Create drop divs for each profile
      echo '<div class="drop" id="'.$profile['id'].'"><span class="drop-text">Drop the '.htmlspecialchars($profile['name']).' video link here</span></div>';
  
      // Build options for the select element
      $selected = $profile['reorder'] === "0" ? 'selected' : '';
      $options .= '<option value="'.$profile['id'].'" '.$selected.'>'.htmlspecialchars($profile['name']).'</option>';
  }
  
  echo '</div>
  <div class="row">
      <form id="download_form" style="margin: 0 auto; border-radius: 5px;" autocomplete="off">
          <div class="download-form">
              <label style="position: relative;">Or paste the full video link : </label>
              <input class="input-link" type="text" placeholder="https://www.youtube.com/watch?v=X">
              <select id="quality" class="quality-select" name="quality" style="min-width: 180px;" onchange="">
                  '.$options.'
              </select>              
      <button class="submit-download"><i class="fas fa-arrow-circle-right"></i></button>
      </form>
  </div></div>';

  echo '</div><div class="content-grey"><div id="queue">
      <ul class="tabs">';
  

    $options_req = $database->prepare('SELECT * FROM options;');
    $options_result = $options_req->execute();

    if ($options_result) {
        $options_data = $options_result->fetchArray();
        if ($options_data) {
            $options_show_last = $options_data['show_last'];
            $options_subtitles = $options_data['subtitles'];
            $options_sub_lang = $options_data['sub_lang'];
        }
    }

    // show last downloads
    $queue_req = $database->prepare('SELECT * FROM queue ORDER BY id DESC;');
    $queue_result = $queue_req->execute();

    while ($queue = $queue_result->fetchArray()) {
        echo '<li id="' . $queue['id'] . '" class="' . $queue['video_id'] . '">
                <img src="thumbnail.php?id=' . $queue['video_id'] . '&type=default">
                <img src="thumbnail.php?id=' . $queue['video_id'] . '&type=1">
                <img src="thumbnail.php?id=' . $queue['video_id'] . '&type=2">
                <div class="loader" id="loader' . $queue['id'] . '"></div>
                <div class="options opt' . $queue['video_id'] . '">
                    <button type="button" class="btn link" id="' . $queue['video_id'] . '"><i class="fab fa-youtube fa-lg"></i> Launch Youtube</button>
                    <button type="button" class="btn terminate" id="' . $queue['id'] . '"><i class="fas fa-times-circle fa-lg"></i> Terminate</button>
                </div>
            </li>';
        ?>
 <script type="text/javascript">
$(document).ready(function() {
    var check<?php echo $queue['id']; ?> = setInterval(function() {
        $.post("queue.php", {
            id: <?php echo $queue['id']; ?>
        }, function(status0<?php echo $queue['id']; ?>) {
            status0<?php echo $queue['id']; ?> = jQuery.parseJSON(status0<?php echo $queue['id']; ?>);
            console.log("Status from queue.php:", status0<?php echo $queue['id']; ?>);
            if (status0<?php echo $queue['id']; ?> != 'downloading') {
                var loaderSelector = "#loader<?php echo $queue['id']; ?>";
                console.log("Loader selector: ", loaderSelector);
                console.log("Loader element exists: ", $(loaderSelector).length > 0);

                if ($(loaderSelector).length > 0) {
                    $(loaderSelector).replaceWith('<div class="text-bloc">' + status0<?php echo $queue['id']; ?>.table + '</div>');
                    console.log("Replaced loader with text-bloc");
                } else {
                    console.error("Loader element not found for replacement");
                }

                $("#queue ul").find("#<?php echo $queue['id']; ?>").css({
                    background: '#CDD7E7'
                });

                var newrenbutton = $("#queue ul").find("#<?php echo $queue['id']; ?>").find(".options").append('<button type="button" class="btn rename" id="' + status0<?php echo $queue['id']; ?>.id + '"><i class="fas fa-edit fa-sm"></i> Rename</button>');
                var newdelbutton = $("#queue ul").find("#<?php echo $queue['id']; ?>").find(".options").append('<button type="button" class="btn delete" id="' + status0<?php echo $queue['id']; ?>.id + '"><i class="fas fa-trash-alt fa-sm"></i> Delete file</button>');

                $(newrenbutton).find(".rename").on("click", function(e) {
                    e.preventDefault();
                    this.blur();
                    var renid = $(this).attr('id');
                    $.get('rename.php?id=' + renid, function(html) {
                        $('#rename-form').html('');
                        $(html.toString()).appendTo('#rename-form');
                        $('#rename-form').modal({
                            modalClass: "modal-rename"
                        });
                    });
                });

                $(newdelbutton).find(".delete").on("click", function(e) {
                    e.preventDefault();
                    this.blur();
                    var delid = $(this).attr('id');
                    $.get('delete.php?id=' + delid, function(html) {
                        $('#delete-form').html('');
                        $(html.toString()).appendTo('#delete-form');
                        $('#delete-form').modal({
                            modalClass: "modal-delete"
                        });
                    });
                });

                $("#queue ul").find("#<?php echo $queue['id']; ?>").attr("id", status0<?php echo $queue['id']; ?>.id);
                window.clearInterval(check<?php echo $queue['id']; ?>);
            }
        });
    }, 5000);
});
</script>

        <?php
    }

    $last_req = $database->prepare('SELECT * FROM downloaded ORDER BY id DESC LIMIT :nbr;');
    $last_req->bindParam(':nbr', $options_show_last, SQLITE3_INTEGER);
    $last_result = $last_req->execute();

    while ($last = $last_result->fetchArray()) {
        $resolution = $last['resolution'] ?? "N/A";
        $duration = $last['duration'] ?? "N/A";
        $filename = $last['filename'] ?? "N/A";
        $size = $last['size'] ?? "N/A";
        $dl_date = $last['date'] ?? "N/A";
        $codec_v = $last['codec_v'] ?? "N/A";
        $bitrate_v = $last['bitrate_v'] ?? "N/A";
        $codec_a = $last['codec_a'] ?? "N/A";
        $bitrate_a = $last['bitrate_a'] ?? "N/A";

        echo '<li id="' . $last['id'] . '" class="li_old_download ' . $last['video_id'] . '" style="">'
            . '<img src="thumbnail.php?id=' . $last['video_id'] . '&type=default">'
            . '<img src="thumbnail.php?id=' . $last['video_id'] . '&type=1">'
            . '<img src="thumbnail.php?id=' . $last['video_id'] . '&type=2">'
            . '<div class="text-bloc">'
            . '<table>'
            . '<tr>'
            . '<td colspan="4" class="table_title" style="padding-bottom:5px">'
            . htmlspecialchars(basename($filename))
            . '</td>'
            . '</tr>'
            . '<tr>'
            . '<td width="50%" colspan="2"><i class="far fa-clock"></i> <b>Duration :</b> ' . $duration . '</td>'
            . '<td width="50%" colspan="2"><i class="fas fa-desktop"></i> <b>Resolution :</b> ' . $resolution . '</td>'
            . '</tr>'
            . '<tr>'
            . '<td colspan="4">'
            . '<table>'
            . '<tr>'
            . '<td width="50%" colspan="2"><i class="fas fa-film"></i> <b>Video :</b> ' . $codec_v . ' @ ' . $bitrate_v . '</td>'
            . '<td width="50%" colspan="2"><i class="fas fa-volume-up"></i> <b>Audio :</b> ' . $codec_a . ' @ ' . $bitrate_a . '</td>'
            . '</tr>'
            . '</table>'
            . '</td>'
            . '</tr>'
            . '<tr>'
            . '<td colspan="2"><i class="far fa-calendar"></i> <b>Date :</b> ' . $dl_date . '</td>'
            . '<td colspan="2"><i class="far fa-hdd"></i> <b>Size :</b> ' . $size . '</td>'
            . '</tr>'
            . '</table>'
            . '<div class="hide"><a id="' . $last['id'] . '" title="Hide this download"><i class="fas fa-times-circle fa-lg"></i></a></div>'
            . '</div><div class="options">'
            . '<button type="button" class="btn link" id="' . $last['video_id'] . '"><i class="fab fa-youtube fa-lg"></i> Launch Youtube</button>'
            . '<button type="button" class="btn rename" id="' . $last['id'] . '"><i class="fas fa-edit fa-sm"></i> Rename</button>'
            . '<button type="button" class="btn delete" id="' . $last['id'] . '"><i class="fas fa-trash-alt fa-sm"></i> Delete file</button>'
            . '</div></li>';
    }
    echo '</ul></div>';
}
?>

<!-- Options Modal -->
<div id="options-form" class="modal">
  <p><b>Options</b></p>
  <form id="options_form" autocomplete="off">
    <p>
      <label style="position: relative;">Previous downloads to show: </label>
      <select id="show_last" name="showlast">
        <option value="0" <?php if ($options_show_last == "0") { echo 'selected="selected"'; } ?>>None</option>
        <option value="1" <?php if ($options_show_last == "1") { echo 'selected="selected"'; } ?>>1</option>
        <option value="3" <?php if ($options_show_last == "3") { echo 'selected="selected"'; } ?>>3</option>
        <option value="5" <?php if ($options_show_last == "5") { echo 'selected="selected"'; } ?>>5</option>
        <option value="10" <?php if ($options_show_last == "10") { echo 'selected="selected"'; } ?>>10</option>
        <option value="20" <?php if ($options_show_last == "20") { echo 'selected="selected"'; } ?>>20</option>
        <option value="50" <?php if ($options_show_last == "50") { echo 'selected="selected"'; } ?>>50</option>
      </select>
    </p>
    <p>
      <label style="position: relative;">Subtitles: </label>
      <select id="subtitles" name="subtitles">
        <option value="0" <?php if ($options_subtitles == "0") { echo 'selected="selected"'; } ?>>None</option>
        <option value="1" <?php if ($options_subtitles == "1") { echo 'selected="selected"'; } ?>>External .srt file</option>
        <option value="2" <?php if ($options_subtitles == "2") { echo 'selected="selected"'; } ?>>Embed Subtitles</option>
      </select>
    </p>
    <p>
      <label style="position: relative;">Subtitle Language (2 letters): </label>
      <input type="text" id="sub_lang" name="sub_lang" maxlength="2" value="<?php echo htmlspecialchars($options_sub_lang ?? ''); ?>">
    </p>
    <p>
      <label style="position: relative;">Download Directory: </label>
      <input type="text" id="download_dir" name="download_dir" value="<?php echo htmlspecialchars($options_download_dir); ?>">
    </p>
    <p>
      <label style="position: relative;">Rename Regex (pattern||replacement per line): </label>
      <textarea id="rename_regex" name="rename_regex" rows="3" placeholder="/pattern/||replacement&#10;/another/||replace"><?php echo htmlspecialchars($options_rename_regex); ?></textarea>
    </p>
  </form>
  <p>
    <a href="#" id="clean_cache">Clean yt-dlp cache</a>
  </p>
  <div class="btn-container">
    <button type="button" class="btn close" rel="modal:close"><i class="fas fa-window-close fa-sm"></i> Save and Close</button>
  </div>
</div>

<script src="js/script.js"></script>

<!-- Profiles Modal -->
<div id="profiles-form" class="modal">
  <p><b>Manage Profiles</b></p>
  <form id="profiles_form" autocomplete="off">
    <div id="profiles-list">
      <?php foreach ($profiles as $profile): ?>
        <div class="profile-item" data-id="<?php echo $profile['id']; ?>">
          <input type="hidden" class="profile-input" name="id" value="<?php echo $profile['id']; ?>" />
          <label>Profile Name:</label>
          <input type="text" class="profile-name-input" name="name" maxlength="45" value="<?php echo isset($profile['name']) ? htmlspecialchars($profile['name']) : ''; ?>" />
          <label>Destination:</label>
          <input type="text" class="profile-input" name="destination" value="<?php echo htmlspecialchars($profile['destination']); ?>" />
          <label>Dest. Path:</label>
          <input type="text" class="profile-input" name="dest_path" value="<?php echo htmlspecialchars($profile['dest_path']); ?>" />
          <label>Container:</label>
          <select class="profile-input" name="container">
            <option value="mkv" <?php if ($profile['container'] == 'mkv') echo 'selected'; ?>>MKV</option>
            <option value="mp4" <?php if ($profile['container'] == 'mp4') echo 'selected'; ?>>MP4</option>
          </select>
          <div class="resolution-container">
            <label>Max Res.:</label>
            <input type="text" class="profile-res-input short-input" name="max_res" maxlength="4" value="<?php echo isset($profile['max_res']) ? htmlspecialchars($profile['max_res']) : ''; ?>" />
            <label>Min Res.:</label>
            <input type="text" class="profile-res-input short-input" name="min_res" maxlength="4" value="<?php echo isset($profile['min_res']) ? htmlspecialchars($profile['min_res']) : ''; ?>" />
          </div>
          <button type="button" class="btn delete-profile" data-id="<?php echo $profile['id']; ?>">Delete</button>
        </div>
      <?php endforeach; ?>
    </div>
    <div class="button-container">
      <button type="button" class="btn" id="add_profile">Add Profile</button>
      <button type="button" class="btn" id="reset_profiles">Reset Profiles</button>
    </div>
  </form>
  <div class="btn-container">
    <button type="button" class="btn close" id="save_close"><i class="fas fa-window-close fa-sm"></i> Save and Close</button>
  </div>
</div>


<!-- Rename Modal -->
<div id="rename-form" class="modal" style="">
</div>

<!-- Delete Modal -->
<div id="delete-form" class="modal" style="">
</div>
</main>
<footer>
<div class="footer"><?php echo $footer; ?></div></div>
</footer>
</body>
</html>
