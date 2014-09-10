
function clear_search_tracks() {
    $('#search_table').html('');
}

function add_search_track(track_obj) {
    var r =  track_obj.duration % 60;
    if (r < 10) { r = '0' + r; }
    var time = parseInt(track_obj.duration / 60) + ':' + r;
    $('#search_table').append('<tr class="" aid="'+ track_obj.aid +'" url="' + track_obj.url + '"><td>' +
            track_obj.artist + ' - ' + track_obj.title +
            '</td><td class="text-right">'+ time + '</td></tr>');

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

    $('#search_table tr.info').removeClass('info');
    tr_el.addClass('info');

    document.getElementById('player').play();
    $('#cur_track_title_p').removeClass('hidden');
    $('#cur_track_title').html(tr_el.find('td:eq(0)').html());

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
      } else {
            $('#login_btn').removeClass('hidden');
     }
}


$(function () {
    $.glob = {};
    $.glob.search_offset = 0;
    $.glob.auth_dict = {};

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

});
