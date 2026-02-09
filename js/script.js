$(document).ready(function() {
    // Global CSRF Token
    var getCsrfToken = function() {
        return $('meta[name="csrf-token"]').attr('content');
    };

    var num = 0;
    var downloadQueue = [];
    var isDownloading = false;

    $.modal.defaults = {
        overlay: "#000",
        opacity: 0.75,
        zIndex: 1,
        escapeClose: false,
        clickClose: false,
        closeText: 'Close',
        showClose: false,
        modalClass: "modal",
        spinnerHtml: null,
        showSpinner: true
    };

    function animateDownload(message = 'Preparing...') {
        $('#queue ul li').each(function() {
            $(this).css('animation', 'PushDown 1s ease-out');
        });

        $('#temp-loader').remove();
        var loaderHtml = `<li id="temp-loader" class="loader-container-temp" style="background: rgb(205, 215, 231); text-align: center; display: flex; flex-direction: column; justify-content: center; align-items: center; min-height: 90px; height: 90px; padding: 0;">
            <div class="loader-temp" style="margin: 0;"></div>
            <div id="temp-loader-msg" style="margin-top: 8px; font-weight: bold; color: #5ba8de; text-transform: uppercase; font-size: 12px; line-height: 1;">${message}</div>
        </li>`;
        $('#queue ul').prepend(loaderHtml);
    }

    $(".submit-download").click(function(e) {
        e.preventDefault();
        var downloadLink = $('.input-link').val();
        var quality = $('.quality-select').val();
        if (downloadLink) {
            downloadQueue.push({ link: downloadLink, quality: quality });
            processDownloadQueue();
        }
        $('.input-link').val('');
    });

    if ($.fn.select2) {
        $('.quality-select').select2({
            theme: "flat",
            minimumResultsForSearch: Infinity
        });
    }

    function processDownloadQueue() {
        if (isDownloading || downloadQueue.length === 0) return;
        isDownloading = true;
        var downloadItem = downloadQueue.shift();
        animateDownload('Analyzing URL...');
        download(downloadItem.link, downloadItem.quality, 0)
            .then(() => {
                isDownloading = false;
                processDownloadQueue();
            })
            .catch(() => {
                isDownloading = false;
                processDownloadQueue();
            });
    }

    function download(url, params, attempt = 0) {
        return new Promise((resolve, reject) => {
            $.ajax({
                url: "thumbnails.php",
                type: "POST",
                data: { url: url },
                headers: { 'X-CSRF-TOKEN': getCsrfToken() },
                success: function(data) {
                    $('#queue ul').find('.loader-container-temp').remove();

                    var response;
                    try {
                        response = JSON.parse(data);
                    } catch (e) {
                        response = { type: 'video', id: data.trim() };
                    }

                    if (response.error) {
                        alert(response.error);
                        reject(response.error);
                        return;
                    }

                    if (response.type === 'playlist') {
                        $('#playlist-title').text(response.title);
                        var $videoList = $('#playlist-videos').empty();
                        response.videos.forEach(function(video) {
                            $videoList.append(`
                                <div style="padding: 5px; border-bottom: 1px solid #eee;">
                                    <label>
                                        <input type="checkbox" class="playlist-video-check" value="${video.url}" data-id="${video.id}" checked>
                                        ${video.title}
                                    </label>
                                </div>
                            `);
                        });
                        
                        $('#download-selected').off('click').on('click', function() {
                            var selectedVideos = [];
                            $('.playlist-video-check:checked').each(function() {
                                selectedVideos.push($(this).val());
                            });
                            $.modal.close();
                            selectedVideos.forEach(function(vUrl) {
                                animateDownload('Preparing video...');
                                download(vUrl, params, 0);
                            });
                        });

                        $('#playlist-modal').modal({ modalClass: "modal-playlist" });
                        resolve();
                        return;
                    }

                    var videoId = response.id;
                    var thisdownload = "dl" + Math.floor(Math.random() * 1000000);
                    var htmlContent = `
                    <li id="${thisdownload}" class="${videoId}" style="background: #f0e7a1;"><img src="thumbnail.php?id=${videoId}&type=default"><img src="thumbnail.php?id=${videoId}&type=1"><img src="thumbnail.php?id=${videoId}&type=2"><div class="text-bloc">
                      <div class="loader" id="loader${thisdownload}"></div></div>
                    <div class="options opt${videoId}">
                      <button type="button" class="btn link" id="${videoId}">
                        <i class="fab fa-youtube fa-lg"></i> Launch Youtube
                      </button>
                    </div>
                  </li>`;
                    $("#queue ul").prepend(htmlContent);

                    setTimeout(function() {
                        var loaderSelector = "#loader" + thisdownload;
                        
                        function requestDownload() {
                            $('#temp-loader-msg').text('Queuing download...');
                            $.ajax({
                                url: "download.php",
                                type: "POST",
                                data: { url: url, id: params, csrf_token: getCsrfToken() },
                                headers: { 'X-CSRF-TOKEN': getCsrfToken() },
                                success: function(status2) {
                                    if (typeof status2 === 'string') {
                                        try { status2 = JSON.parse(status2); } catch (e) {
                                            $(loaderSelector).replaceWith('<div class="text-bloc">' + status2 + '</div>');
                                            resolve(); return;
                                        }
                                    }

                                    if (status2.error) {
                                        $(loaderSelector).replaceWith('<div class="text-bloc">' + status2.error + '</div>');
                                        resolve(); return;
                                    }

                                    if (status2.status === 'queued') {
                                        var queueId = status2.id;
                                        var $li = $("#" + thisdownload);
                                        // Update ID and set initial gradient (0% green, 100% yellow)
                                        $li.attr("id", queueId).css("background", "linear-gradient(to right, #d4edda 0%, #f0e7a1 0%)");
                                        
                                        var $options = $li.find(".options");
                                        if ($options.find(".terminate").length === 0) {
                                            $options.append('<button type="button" class="btn terminate" id="' + queueId + '"><i class="fas fa-times-circle fa-lg"></i> Terminate</button>');
                                        }

                                        $(loaderSelector).replaceWith(`<div class="loader" id="loader${queueId}"></div>`);
                                        startPolling(queueId);
                                        resolve();
                                        return;
                                    }
                                    resolve();
                                },
                                error: function(jqXHR) {
                                    var errText = jqXHR.status ? jqXHR.status + ' ' + jqXHR.statusText : 'Download failed';
                                    $(loaderSelector).replaceWith('<div class="text-bloc">' + errText + '</div>');
                                    resolve();
                                }
                            });
                        }
                        requestDownload();
                    }, 500);
                },
                error: function() {
                    $('#queue ul').find('.loader-container-temp').remove();
                    alert("Failed to analyze video.");
                    reject();
                }
            });
        });
    }

    function startPolling(queueId) {
        var checkInterval = setInterval(function() {
            $.post("queue.php", { id: queueId, csrf_token: getCsrfToken() }, function(status) {
                try {
                    status = JSON.parse(status);
                    if (status.status == 'downloading') {
                        // Correct linear-gradient syntax: color1 start, color1 end, color2 start, color2 end
                        var progress = status.progress; // e.g. "45.2%"
                        $('.tabs li#' + queueId).css("background", "linear-gradient(to right, #d4edda " + progress + ", #f0e7a1 " + progress + ")");
                    } else {
                        var finalLoaderSelector = "#loader" + queueId;
                        if ($(finalLoaderSelector).length > 0) {
                            $(finalLoaderSelector).replaceWith('<div class="text-bloc">' + status.table + '</div>');
                        }
                        var $li = $('.tabs li#' + queueId);
                        $li.css({ background: '#CDD7E7' });
                        var $finalOptions = $li.find(".options");
                        $finalOptions.find(".terminate").remove();
                        if ($finalOptions.find(".rename").length === 0) {
                            $finalOptions.append('<button type="button" class="btn rename" id="' + status.id + '"><i class="fas fa-edit fa-sm"></i> Rename</button>');
                            $finalOptions.append('<button type="button" class="btn delete" id="' + status.id + '"><i class="fas fa-trash-alt fa-sm"></i> Delete file</button>');
                        }
                        window.clearInterval(checkInterval);
                    }
                } catch(e) { window.clearInterval(checkInterval); }
            });
        }, 2000);
    }

    // Initial Polling for existing items
    $('.tabs li .loader').each(function() {
        var queueId = $(this).closest('li').attr('id');
        if (queueId && !isNaN(queueId)) startPolling(queueId);
    });

    function saveProfiles(callback) {
        var profiles = [];
        $('#profiles-list .profile-item').each(function(index) {
            profiles.push({
                id: $(this).find('input[name="id"]').val(),
                name: $(this).find('input[name="name"]').val(),
                destination: $(this).find('input[name="destination"]').val(),
                dest_path: $(this).find('input[name="dest_path"]').val(),
                container: $(this).find('select[name="container"]').val(),
                max_res: $(this).find('input[name="max_res"]').val(),
                min_res: $(this).find('input[name="min_res"]').val(),
                reorder: index
            });
        });
        if (profiles.length === 0) { if (callback) callback(); return; }
        var completed = 0;
        profiles.forEach(function(profile) {
            $.post('options.php?update_profile=true', profile, function() {
                completed++;
                if (completed === profiles.length && callback) callback();
            });
        });
    }

    function loadProfiles() {
        $.get('options.php?get_profiles=true', function(html) {
            $('#profiles-list').html(html);
            enableProfileSorting();
        });
    }

    function enableProfileSorting() {
        if ($.fn.sortable) {
            $('#profiles-list').sortable({ placeholder: "ui-state-highlight", forcePlaceholderSize: true });
        }
    }

    enableProfileSorting();

    $(document).on('change', '#options_form input, #options_form select, #options_form textarea', function() {
        $.post('options.php?submit=true', $('#options_form').serialize());
    });

    $(document).on('click', '#save_options_close', function(e) {
        e.preventDefault();
        $.post('options.php?submit=true', $('#options_form').serialize(), function() {
            window.location.reload();
        });
    });

    $(document).on('click', '#save_close', function(e) {
        e.preventDefault();
        saveProfiles(function() { window.location.reload(); });
    });

    $(document).on('modal:open', '#profiles-form', function() { enableProfileSorting(); });

    $(document).on('click', '.delete-profile', function() {
        var id = $(this).data('id');
        if (confirm('Are you sure?')) {
            $.post('profiles.php', { delete_profile: true, id: id }, function(res) {
                if (res.status === 'success') { loadProfiles(); location.reload(); }
            }, 'json');
        }
    });

    // Drag and Drop Logic
    $(document).on('dragenter dragover', '.drop', function(e) {
        e.preventDefault();
        e.stopPropagation();
        $(this).css({ 'border': '2px dashed #ff5177', 'background': 'rgba(255,255,255,0.50)' });
    });

    $(document).on('dragleave', '.drop', function(e) {
        e.preventDefault();
        e.stopPropagation();
        $(this).css({ 'border': '2px dashed #3f51b5', 'background': '#ffffff' });
    });

    $(document).on("drop", ".drop", function(e) {
        e.preventDefault();
        e.stopPropagation();
        $(this).css({ 'border': '2px dashed #3f51b5', 'background': '#ffffff' });
        var dt = e.originalEvent.dataTransfer;
        var url = dt.getData('url') || dt.getData('text/uri-list') || dt.getData('text') || dt.getData('Text');
        if (url) {
            animateDownload('Analyzing URL...');
            download(url, $(this).attr('id'), 0);
        }
    });

    // Queue Item Interactions
    $(document).on('click', '.tabs li', function() {
        $(this).toggleClass("li_old_download_clicked").find(".options").slideToggle(50);
    });

    $(document).on('click', '.tabs li .options', function(e) { e.stopPropagation(); });

    $(document).on('click', '.tabs li .link', function(e) {
        e.preventDefault();
        window.open('https://www.youtube.com/watch?v=' + $(this).attr('id'));
    });

    $(document).on('click', '.tabs li .rename', function(e) {
        e.preventDefault();
        var renid = $(this).attr('id');
        $.get('rename.php?id=' + renid, function(html) {
            $('#rename-form').html(html).modal({ modalClass: "modal-rename" });
        });
    });

    $(document).on('click', '.tabs li .delete', function(e) {
        e.preventDefault();
        var delid = $(this).attr('id');
        $.get('delete.php?id=' + delid, function(html) {
            $('#delete-form').html(html).modal({ modalClass: "modal-delete" });
        });
    });

    $(document).on('click', '.tabs li .terminate', function(e) {
        e.preventDefault();
        var tid = $(this).attr('id');
        $.post('terminate.php', { id: tid }, function(res) {
            var json = JSON.parse(res);
            if (json.status === "terminated") location.reload();
            else alert(json.message);
        });
    });

    $(document).on("click", "div.hide a", function(e) {
        e.preventDefault();
        var hideid = $(this).attr('id');
        $.post("delete.php?id=" + hideid, { file: "false" }, function(res) {
            if (res.trim() == 'done') {
                $('.tabs li[id=' + hideid + ']').hide('fast', function() { $(this).remove(); });
            }
        });
    });
});
