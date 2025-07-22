<!DOCTYPE html>
<html lang="en">
<head>
    <meta http-equiv="content-type" content="text/html; charset=utf-8" />
    <title>Simple Youtube PHP Downloader</title>
    <?php $basePath = rtrim(dirname($_SERVER['SCRIPT_NAME']), '/').'/'; ?>
    <link rel="shortcut icon" href="<?php echo $basePath; ?>favicon.ico" type="image/x-icon">
    <link rel="icon" href="<?php echo $basePath; ?>favicon.png" type="image/png">
    <link rel="icon" sizes="32x32" href="<?php echo $basePath; ?>favicon-32.png" type="image/png">
    <link rel="icon" sizes="64x64" href="<?php echo $basePath; ?>favicon-64.png" type="image/png">
    <link rel="icon" sizes="96x96" href="<?php echo $basePath; ?>favicon-96.png" type="image/png">
    <link rel="stylesheet" href="https://use.fontawesome.com/releases/v5.7.2/css/all.css" integrity="sha384-fnmOCqbTlWIlj8LyTjo7mOUStjsKC4pOpQbqyi7RrhN7udi9RwhKkMHpvLbHG9Sr" crossorigin="anonymous">
    <link href="https://fonts.googleapis.com/css?family=Open+Sans" rel="stylesheet"> 
    <link href="https://fonts.googleapis.com/css?family=Exo" rel="stylesheet"> 
    <link rel="stylesheet" href="css/main.css">
    <!-- Use local versions of jQuery and jQuery UI -->
    <script src="js/jquery-3.6.0.min.js"></script>
    <link rel="stylesheet" href="css/jquery-ui.min.css">
    <script src="js/jquery-ui.min.js"></script>
    <link rel="stylesheet" href="css/jquery.modal.min.css" />
    <script src="js/jquery.modal.min.js"></script>
    <!-- Use local version of Select2 -->
    <link href="css/select2.min.css" rel="stylesheet" />
    <link href="css/select2-flat-theme.css" rel="stylesheet" />
    <script src="js/select2.min.js"></script>
    <link href="css/jquery.modal.css" rel="stylesheet" />
</head>
<body>
    <header class="header">
        <div class="row">
            <div class="menu">
                <a href="" class="logo">
                    <img src="img/logo_small.png">
                    <div>SUJIB</div>
                </a>
                <div class="app">The PHP Youtube Video Download Manager</div>
                <?php if (isset($showNav) && $showNav): ?>
                <nav>
                    <a href="#profiles-form" rel="modal:open" class="nav-link">PROFILES</a>
                    <a href="#options-form" rel="modal:open" class="nav-link">OPTIONS</a>
                </nav>
                <?php endif; ?>
            </div>
        </div>
    </header>
