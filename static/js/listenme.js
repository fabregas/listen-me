
function clear_search_tracks() {
    $('#search_table').html('');
}

function duration_hum(duration_i) {
    var r =  duration_i % 60;
    if (r < 10) { r = '0' + r; }
    return parseInt(duration_i / 60) + ':' + r;
}

function add_search_track(track_obj) {
    $('#search_table').append('<tr class="" aid="'+ track_obj.aid +'" url="' + track_obj.url + 
            '" duration="'+track_obj.duration+'" artist="'+track_obj.artist+'" title="'+track_obj.title+'"><td>' +
            track_obj.artist + ' - ' + track_obj.title +
            '</td><td class="text-right">'+ duration_hum(track_obj.duration) + '</td></tr>');

    $('#search_table tr[aid="'+track_obj.aid+'"]').click(on_track_click);
}

function search_audio() {
    var query = $('#audio_search_inp').val();
    if ((! query) || (query.length < 3)) {
        return;
    }
    
    $.glob.search_offset = 0;
    clear_search_tracks();
    search_audio_next();
}

function search_audio_next() {
    var query = $('#audio_search_inp').val();
    if ((! query) || (query.length < 3)) {
        return;
    }
    VK.Api.call('audio.search', {q: query, performer_only: 0, sort: 2, offset: $.glob.search_offset, count: 20}, function(r) {
        //console.log(r);
        if(r.response) { 
            $.glob.search_offset += r.response.length - 1;

            for(var i = 1; i < r.response.length; i++) {
                add_search_track(r.response[i]);
            }
        } else {
            alert(r.error.message);
        }        
    });
}

function play_track(tr_el) {
    $('audio').attr('src', tr_el.attr('url'));
    $('audio').attr('aid', tr_el.attr('aid'));

    $('#search_table tr.info').removeClass('info');
    tr_el.addClass('info');

    document.getElementById('player').play();
    $('#cur_track_title_p').removeClass('hidden');
    $('#cur_track_title').html(tr_el.find('td:eq(0)').html());

    check_add_to_pl_btn();
}

function check_add_to_pl_btn() {
    if (! $('#add_to_playlist').hasAttr('disabled')) {
        return;
    }
    if (! $('audio').hasAttr('aid')) {
        return;
    }
    if (! $('#select_playlists_h').hasAttr('plid')) {
        return;
    }
    $('#add_to_playlist').removeAttr('disabled');
}

function on_track_click(e) {
    play_track($(e.target).parent());
}

function play_next_track() {
    var tr_el = $('#search_table tr.info').first().next();
    if (tr_el.length == 0) {
        tr_el = $('#search_table tr').first();
    }
    play_track(tr_el);
}

function authInfo(response) {
      if (response.session) {
            $.glob.auth_dict = {'mid': response.session.mid, 'expire': response.session.expire, 'secret': response.session.secret,
                                'sid': response.session.sid, 'sig': response.session.sig}

            //var params = {param: val};
            //$.extend(params, $.glob.auth_dict);

            VK.Api.call('users.get', {uids: response.session.mid, fields:'photo_50'}, function(r) { 
                if(r.response) { 
                    $('#user_avatar').attr('src', r.response[0].photo_50);
                    $('#user_avatar').attr('title', r.response[0].first_name + ' ' + r.response[0].last_name);
                    $('#user_avatar').removeClass('hidden');
                    $('#login_btn').addClass('hidden');
                } 
            }); 
     
            load_playlists();
      } else {
            $('#login_btn').removeClass('hidden');
     }
}

function load_playlists() {
    var params = {count: 10};
    $.extend(params, $.glob.auth_dict);

    $.post('/get_playlists', params, function(data) {
        if (data['error'].length > 0) {
            alert('ERROR! ' + data['error']);
            return;
        }

        data = data['data'];
        $('#select_playlists_ddn').html('');
        for (var i=0; i < data.length; i++) {
            $('#select_playlists_ddn').append('<li role="presentation"><a role="menuitem" tabindex="-1" plid="' + 
                data[i][0]+'">'+data[i][1]+'</a></li>');
        }

        $('#select_playlists_ddn a').click(function(e) {
            select_playlist($(e.target).attr('plid'), $(e.target).html());
        });

        if (data.length == 0) {
            $('#select_playlists_h').html('Create your first playlist');
            $('#select_playlists_h').attr('disabled', 'disabled');
        } else {
            select_playlist(data[0][0], data[0][1]);
        }
    });
}

function select_playlist(pl_id, pl_label, force) {
    if ((! force) && (pl_id == $('#select_playlists_h').attr('plid'))) {
        return;
    }
    $('#select_playlists_h').html(pl_label + '&nbsp;&nbsp;<span class="caret"></span>');
    $('#select_playlists_h').attr('plid', pl_id);
    $('#select_playlists_h').attr('pllabel', pl_label);
    $('#select_playlists_h').attr('pldescr', '');
    $('#epl_btn').removeAttr('disabled');

    var params = {id: pl_id};
    $.extend(params, $.glob.auth_dict);
    $.post('/get_playlist_info', params, function(data) {
        if (data['error'].length > 0) {
            alert(data['error']);
            return
        }
        $('#select_playlists_h').attr('pldescr', data['description']);

        $('#pl_ui').html('');
        $.playlist_order = {};
        for (var i=0; i<data.tracks.length; i++){
            var tr = data.tracks[i];
            add_local_to_playlist(tr['aid'], tr['artist'] + ' - ' + tr['title'], duration_hum(tr['duration']));
        }
    });
}


function add_new_playlist() {
    $('#add_pl_err').html('');
    $('#f_pl_label').parent().removeClass('has-error');
    $('#f_pl_label').val('');
    $('#f_pl_descr').val('');
    $('#AddPlaylistModal').modal('show');
}

function mod_playlist() {
    $('#mod_pl_err').html('');
    $('#fm_pl_label').parent().removeClass('has-error');
    $('#fm_pl_id').val($('#select_playlists_h').attr('plid'));
    $('#fm_pl_label').val($('#select_playlists_h').attr('pllabel'));
    $('#fm_pl_descr').val($('#select_playlists_h').attr('pldescr'));
    $('#ModPlaylistModal').modal('show');
}



function create_playlist() {
    var pl_label = $('#f_pl_label').val();
    var pl_descr =  $('#f_pl_descr').val();
    $('#add_pl_err').html('');

    if (pl_label.length < 3) {
        $('#f_pl_label').parent().addClass('has-error');
        return;
    }
    $('#f_pl_label').parent().removeClass('has-error');
    $('#add_pl_btn').attr('disabled', 'disabled');

    var params = {label: pl_label, descr: pl_descr};
    $.extend(params, $.glob.auth_dict);
    $.post('/add_playlist', params).done(function(data) {
        if (data.error.length > 0) {
            $('#add_pl_err').html('<div class="alert alert-danger" role="alert"><b>Error! '+ data.error +'</b></div>');
            return;
        }
        
        $('<li role="presentation"><a role="menuitem" tabindex="-1" plid="' + 
                data.pl_id + '">'+pl_label+'</a></li>').prependTo('#select_playlists_ddn');

        select_playlist(data.pl_id, pl_label);
        
        check_add_to_pl_btn();

        $('#select_playlists_h').removeAttr('disabled'); 
        $('#AddPlaylistModal').modal('hide');
    }).fail(function(err) { 
        console.log(err);
        $('#add_pl_err').html('<div class="alert alert-danger" role="alert"><b>'+ err.responseText +'</b></div>');
    }).always(function() {  
        $('#add_pl_btn').removeAttr('disabled');
    });
}

function modify_playlist() {
    var pl_id = $('#fm_pl_id').val();
    var pl_label = $('#fm_pl_label').val();
    var pl_descr =  $('#fm_pl_descr').val();
    $('#mod_pl_err').html('');

    if (pl_label.length < 3) {
        $('#fm_pl_label').parent().addClass('has-error');
        return;
    }
    $('#fm_pl_label').parent().removeClass('has-error');
    $('#mod_pl_btn').attr('disabled', 'disabled');

    var params = {label: pl_label, descr: pl_descr, id: pl_id};
    $.extend(params, $.glob.auth_dict);
    $.post('/mod_playlist', params).done(function(data) {
        if (data.error.length > 0) {
            $('#mod_pl_err').html('<div class="alert alert-danger" role="alert"><b>Error! '+ data.error +'</b></div>');
            return;
        }
        
        $('#select_playlists_ddn a[plid="'+pl_id+'"]').html(pl_label);
        $('#select_playlists_h').html(pl_label + '&nbsp;&nbsp;<span class="caret"></span>');
        $('#select_playlists_h').attr('pllabel', pl_label);
        $('#select_playlists_h').attr('pldescr', pl_descr);

        $('#ModPlaylistModal').modal('hide');
    }).fail(function(err) { 
        console.log(err);
        $('#mod_pl_err').html('<div class="alert alert-danger" role="alert"><b>'+ err.responseText +'</b></div>');
    }).always(function() {  
        $('#mod_pl_btn').removeAttr('disabled');
    });
    
}

function remove_playlist_ask() {
    $('#ModPlaylistModal').modal('hide');
    $('#fd_plid').html($('#select_playlists_h').attr('pllabel'));
    $('#ApplyDeletePlaylistModal').modal('show');
}

function remove_playlist() {
    var pl_id = $('#fm_pl_id').val();

    $('#a_del_pl_btn').attr('disabled', 'disabled');
    var params = {id: pl_id};
    $.extend(params, $.glob.auth_dict);
    $.post('/del_playlist', params).done(function(data) {
        if (data.error.length > 0) {
            $('#del_pl_err').html('<div class="alert alert-danger" role="alert"><b>Error! '+ data.error +'</b></div>');
            return;
        }

        $('#select_playlists_ddn a[plid="'+pl_id+'"]').parent().remove();
        
        f_li = $('#select_playlists_ddn li:first').children().first();

        if (f_li.length == 0) {
            $('#select_playlists_h').html('Create your first playlist');
            $('#select_playlists_h').attr('disabled', 'disabled'); 
            $('#epl_btn').attr('disabled', 'disabled');
            $('#sbt_btn').attr('disabled', 'disabled');
        } else {
            select_playlist(f_li.attr('plid'), f_li.html());
        }

        $('#ApplyDeletePlaylistModal').modal('hide');
    }).fail(function(err) { 
        console.log(err);
        $('#del_pl_err').html('<div class="alert alert-danger" role="alert"><b>'+ err.responseText +'</b></div>');
    }).always(function() {  
        $('#a_del_pl_btn').removeAttr('disabled');
    });
}

function add_local_to_playlist(aid, track, duration) {
    var pl_li = '<li class="list-group-item" aid="'+aid+'">' +
                    '<button class="pl_tr_rm btn btn-xs hidden" title="Remove track"><span class="glyphicon glyphicon-remove"></span></button>&nbsp;' +
                    '<span class="pl_track_name">'+track+'</span><span class="pl_track_duration">'+duration+'</span>' +
                '</li>';
    $('#pl_ui').append(pl_li); 
    
    $('.sortable li:last').hover(function() {
            $(this).find('.pl_tr_rm').removeClass('hidden');
        },
        function() { 
            $(this).find('.pl_tr_rm').addClass('hidden');
    });

    $('.sortable li:last .pl_tr_rm').click(rm_track);

    $.playlist_order[aid] = $('#pl_ui li').length;

    $('.sortable').unbind('sortupdate');
    $('.sortable').sortable('destroy');
    $('.sortable').sortable().bind('sortupdate', function() {
        change_tracks_order();
    });
}

function add_to_playlist() {
    var tr_o = $('#search_table tr[aid="'+$('audio').attr('aid')+'"]');

    if ($('#pl_ui li[aid="'+tr_o.attr('aid')+'"]').length > 0) {
        alert('Track "'+tr_o.find('td:first').html()+'" is already in playlist!');
        return;
    }

    $('#add_to_playlist').attr('disabled', 'disabled');
    var params = {pl_id: $('#select_playlists_h').attr('plid'), aid: tr_o.attr('aid'), 
                 url: tr_o.attr('url'), duration: tr_o.attr('duration'),
                 artist: tr_o.attr('artist'), title: tr_o.attr('title')};
    $.extend(params, $.glob.auth_dict);

    $.post('/add_to_playlist', params).done(function(data) {
        if (data.error.length > 0) {
            alert(data.error);
            return;
        }

        add_local_to_playlist(tr_o.attr('aid'), tr_o.find('td:first').html(), tr_o.find('td:last').html())
    }).fail(function(err) { 
        console.log(err)
        alert(err.statusText);
    }).always(function() {  
        $('#add_to_playlist').removeAttr('disabled');
    });
}

function change_tracks_order() {
    var change_map = [];
    $('#pl_ui li').each(function(index) {
        var aid = $(this).attr('aid');
        if ($.playlist_order[aid] != index+1) {
            $.playlist_order[aid] = index+1;
            change_map.push({'aid': aid, 'index': index+1});
        }
    });
    console.log($.playlist_order);

    var params = {tracks: change_map, pl_id: $('#select_playlists_h').attr('plid')};
    console.log(params);
    $.extend(params, $.glob.auth_dict);
    $.post('/change_playlist', params).done(function(data) {
        if (data.error.length > 0) {
            alert(data.error);
            select_playlist($('#select_playlists_h').attr('plid'), $('#select_playlists_h').attr('pllabel'), true);
            return;
        } 
    }).fail(function(err) { 
        console.log(err)
        select_playlist($('#select_playlists_h').attr('plid'), $('#select_playlists_h').attr('pllabel'), true);
        alert(err.statusText);

    });
}

function rm_track() {
    console.log($(this).parent());
    $('#del_track_err').html('');
    $('#dt_name').attr('aid', $(this).parent().attr('aid'));
    $('#dt_name').html($(this).parent().find('span.pl_track_name').html());
    $('#ApplyDeleteTrackModal').modal('show');
}

function root_remove_track() {
    var pl_id = $('#select_playlists_h').attr('plid');
    var tr_id = $('#dt_name').attr('aid');

    $('#a_del_tr_btn').attr('disabled', 'disabled');
    var params = {pl_id: pl_id, aid: tr_id};
    $.extend(params, $.glob.auth_dict);
    $.post('/del_track', params).done(function(data) {
        if (data.error.length > 0) {
            $('#del_track_err').html('<div class="alert alert-danger" role="alert"><b>Error! '+ data.error +'</b></div>');
            return;
        }

        $('#pl_ui li[aid="'+tr_id+'"]').remove();

        $('#ApplyDeleteTrackModal').modal('hide');
    }).fail(function(err) { 
        $('#del_track_err').html('<div class="alert alert-danger" role="alert"><b>'+ err.responseText +'</b></div>');
    }).always(function() {  
        $('#a_del_tr_btn').removeAttr('disabled');
    });
}

$(function () {
    $.glob = {};
    $.glob.search_offset = 0;
    $.glob.auth_dict = {};
    $.playlist_order = {};

    $('#audio_search_inp').keypress(function( event ) {
        if ( event.which == 13 ) {
            search_audio();
        }
    });

    $( window ).scroll(function(e) {
        if($(window).scrollTop() + $(window).height() == $(document).height()) {
            search_audio_next();
        }
    });

    document.getElementById('player').addEventListener('ended', play_next_track);

    VK.init({
        apiId:4543993
    });

    VK.Auth.getLoginStatus(authInfo);

    $('#home_btn').click(function() {
       $.post('/auth', $.glob.auth_dict, function(data) { alert(data); }); 
    });

    $('#AddPlaylistModal').on('shown.bs.modal', function (e) {
        $('#f_pl_label').focus();
    });
    //.keypress(function( event ) {
    //    if ( event.which == 13 ) {
    //        create_playlist();
    //    }
    //});

    $('#ModPlaylistModal').on('shown.bs.modal', function (e) {
        $('#fm_pl_label').focus();
    });
    //.keypress(function( event ) {
    //    if ( event.which == 13 ) {
    //        modify_playlist();
    //    }
    //});

    $(document).keydown(function(e){
        if (e.keyCode === 27) {
            $('#AddPlaylistModal').modal('hide');
            $('#ModPlaylistModal').modal('hide');
            $('#ApplyDeletePlaylistModal').modal('hide');
        }
    });

    $.fn.hasAttr = function(name) {  
           return this.attr(name) !== undefined;
    };
});
