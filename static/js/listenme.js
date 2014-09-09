
function search_audio_edit(key) {
    alert(key);
}
function search_audio() {
    console.log( "search_audio() called." );
}

$(function () {

    $('#audio_search_inp').keypress(function( event ) {
        if ( event.which == 13 ) {
            search_audio();
        }
    });

});
