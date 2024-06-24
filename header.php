<!DOCTYPE html>
<html lang="en">
<head>
    <meta http-equiv="content-type" content="text/html; charset=utf-8" />
    <title>Simple Youtube PHP Downloader</title>
    <link rel="shortcut icon" href="favicon.ico" type="image/x-icon">
    <link rel="icon" href="favicon.png" type="image/png">
    <link rel="icon" sizes="32x32" href="favicon-32.png" type="image/png">
    <link rel="icon" sizes="64x64" href="favicon-64.png" type="image/png">
    <link rel="icon" sizes="96x96" href="favicon-96.png" type="image/png"> 
    <link rel="stylesheet" href="https://use.fontawesome.com/releases/v5.7.2/css/all.css" integrity="sha384-fnmOCqbTlWIlj8LyTjo7mOUStjsKC4pOpQbqyi7RrhN7udi9RwhKkMHpvLbHG9Sr" crossorigin="anonymous">
    <link href="https://fonts.googleapis.com/css?family=Open+Sans" rel="stylesheet"> 
    <link href="https://fonts.googleapis.com/css?family=Exo" rel="stylesheet"> 
    <link rel="stylesheet" href="css/main.css">
    <!-- Utiliser les versions CDN de jQuery, jQuery UI et jQuery Modal -->
    <script src="https://code.jquery.com/jquery-3.6.0.min.js"></script> 
    <link rel="stylesheet" href="https://code.jquery.com/ui/1.12.1/themes/base/jquery-ui.css">
    <script src="https://code.jquery.com/ui/1.12.1/jquery-ui.js"></script>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/jquery-modal/0.9.1/jquery.modal.min.css" />
    <script src="https://cdnjs.cloudflare.com/ajax/libs/jquery-modal/0.9.1/jquery.modal.min.js"></script>
    <!-- Utiliser les versions CDN de Select2 -->
    <link href="https://cdn.jsdelivr.net/npm/select2@4.1.0-rc.0/dist/css/select2.min.css" rel="stylesheet" />
    <link href="css/select2-flat-theme.css" rel="stylesheet" />
    <script src="https://cdn.jsdelivr.net/npm/select2@4.1.0-rc.0/dist/js/select2.min.js"></script>
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
