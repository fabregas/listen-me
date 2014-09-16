
import os
import cgi
import urllib
import json
import time
from hashlib import md5

from google.appengine.api import users
from google.appengine.ext import ndb

import webapp2
import jinja2


class Config(ndb.Model):
    key = ndb.StringProperty(indexed=True)
    value = ndb.StringProperty(indexed=False)

class Track(ndb.Model):
    aid = ndb.IntegerProperty(indexed=True)
    artist = ndb.StringProperty(indexed=True)
    title = ndb.StringProperty(indexed=True)
    duration = ndb.IntegerProperty()
    genre = ndb.IntegerProperty(default=-1)
    url = ndb.StringProperty(indexed=False)
    index = ndb.IntegerProperty()

class Playlist(ndb.Model):
    owner = ndb.StringProperty(indexed=True)
    name = ndb.StringProperty(indexed=False)
    description = ndb.StringProperty(indexed=False)
    date = ndb.DateTimeProperty(auto_now_add=True)
    tags = ndb.StringProperty(repeated=True)
    tracks = ndb.StructuredProperty(Track, repeated=True)



def auth(params):
    expire = params.get('expire', None)
    mid = params.get('mid', None)
    secret = params.get('secret', None)
    sid = params.get('sid', None)
    sig = params.get('sig', None)

    if (expire is None) or (mid is None) or (secret is None) or (sid is None) or (sid is None):
        raise ValueError('Invalid auth parameters! Expected expire, mid, secret, sid, sig')

    sign = 'expire=%smid=%ssecret=%ssid=%s%s'%(expire, mid, secret, sid, AUTH_SECRET)
    sign = md5(sign).hexdigest()

    if sign != sig:
        raise Exception('Invalid auth!')

    if int(expire) < time.time():
        raise Exception('Session is expired! %s > %s'%(int(expire), time.time()))

    return mid

class AuthPage(webapp2.RequestHandler):
    def post(self):
        user_id = auth(self.request)
        self.response.write('OK for user %s'%user_id)


class AddPlaylist(webapp2.RequestHandler):
    def post(self):
        error = ''
        pl_id = None
        try:
            user_id = auth(self.request)

            pl_label = self.request.get('label', '')
            pl_descr = self.request.get('descr', '')

            if len(pl_label) < 3:
                raise Exception('Label is too short!')

            pl_obj = Playlist(owner=user_id, name=pl_label, description=pl_descr)
            pl_obj.put()
            pl_id = pl_obj.key.id()
        except Exception, err:
            error = str(err)

        self.response.headers['Content-Type'] = 'application/json'
        self.response.write(json.dumps({'pl_id': pl_id, 'error': error}))

class AddToPlaylist(webapp2.RequestHandler):
    def post(self):
        error = ''

        def a_get(attr):
            val = self.request.get(attr, None)
            if not val:
                raise Exception('Expected "%s" attribute'%attr)
            return val

        try:
            user_id = auth(self.request)

            pl_id = a_get('pl_id')
            aid = a_get('aid')
            artist = a_get('artist')
            title = a_get('title')
            url = a_get('url')
            duration = a_get('duration')

            key = ndb.Key('Playlist', int(pl_id))
            pl = key.get()

            track = Track(aid=int(aid), artist=artist, title=title, \
                        duration=int(duration), url=url, index=len(pl.tracks)+1)


            pl.tracks.append(track) 
            pl.put()
        except Exception, err:
            error = str(err)

        self.response.headers['Content-Type'] = 'application/json'
        self.response.write(json.dumps({'error': error}))

class ChangePlaylist(webapp2.RequestHandler):
    def post(self):
        error = ''

        try:
            user_id = auth(self.request)
            pl_id = self.request.get('pl_id', None)
            if pl_id is None:
                raise Exception('Expected "pl_id" attribute')

            i = 0
            mod_tracks = {}
            while True:
                aid = self.request.get('tracks[%i][aid]'%i, None)
                if aid is None:
                    break
                index = self.request.get('tracks[%i][index]'%i, None)
                mod_tracks[int(aid)] = (index,)
                i += 1

            key = ndb.Key('Playlist', int(pl_id))
            pl = key.get()
            for track in pl.tracks:
                mod_info = mod_tracks.get(track.aid, None)
                if mod_info is None:
                    continue
                if mod_info[0] is not None:
                    track.index = int(mod_info[0])
            pl.put()
        except Exception, err:
            error = str(err)

        self.response.headers['Content-Type'] = 'application/json'
        self.response.write(json.dumps({'error': error}))

class ModPlaylist(webapp2.RequestHandler):
    def post(self):
        error = ''
        pl_id = None
        try:
            user_id = auth(self.request)

            pl_id = self.request.get('id', '')
            if not pl_id:
                raise Exception('Expected ID attribute!')
            pl_label = self.request.get('label', '')
            pl_descr = self.request.get('descr', '')

            if len(pl_label) < 3:
                raise Exception('Label is too short!')

            key = ndb.Key('Playlist', int(pl_id))
            pl_obj = key.get()
            pl_obj.name = pl_label
            pl_obj.description = pl_descr
            pl_obj.put()
        except Exception, err:
            error = str(err)

        self.response.headers['Content-Type'] = 'application/json'
        self.response.write(json.dumps({'pl_id': pl_id, 'error': error}))

class DelPlaylist(webapp2.RequestHandler):
    def post(self):
        error = ''
        try:
            user_id = auth(self.request)

            pl_id = self.request.get('id', '')
            if not pl_id:
                raise Exception('Expected ID attribute!')

            key = ndb.Key('Playlist', int(pl_id))
            key.delete()
        except Exception, err:
            error = str(err)

        self.response.headers['Content-Type'] = 'application/json'
        self.response.write(json.dumps({'error': error}))

class DelTrack(webapp2.RequestHandler):
    def post(self):
        error = ''
        try:
            user_id = auth(self.request)

            pl_id = self.request.get('pl_id', '')
            if not pl_id:
                raise Exception('Expected "pl_id" attribute!')
            aid = self.request.get('aid', '')
            if not aid:
                raise Exception('Expected "aid" attribute!')
            aid = int(aid)

            key = ndb.Key('Playlist', int(pl_id))
            pl = key.get()
            rm_i = None
            for i, track in enumerate(pl.tracks):
                if track.aid == aid:
                    rm_i = i
                    break

            if rm_i is not None:
                del pl.tracks[rm_i]
                pl.put()
        except Exception, err:
            error = str(err)

        self.response.headers['Content-Type'] = 'application/json'
        self.response.write(json.dumps({'error': error}))

class GetPlaylists(webapp2.RequestHandler):
    def post(self):
        error = ''
        data = []
        try:
            user_id = auth(self.request)

            count = int(self.request.get('count', 20))
            offset = int(self.request.get('offset', 0))

            pl_query = Playlist.query(Playlist.owner==user_id).order(-Playlist.date)
            pls = pl_query.fetch(count, offset=offset)

            data = [(pl.key.id(), pl.name) for pl in pls]
        except Exception, err:
            error = str(err)

        self.response.headers['Content-Type'] = 'application/json'
        self.response.write(json.dumps({'data': data, 'error': error}))

class GetPlaylistInfo(webapp2.RequestHandler):
    def post(self):
        error = descr = ''
        tracks = []
        try:
            user_id = auth(self.request)

            count = int(self.request.get('count', 20))
            offset = int(self.request.get('offset', 0))

            pl_id = self.request.get('id', '')
            if not pl_id:
                raise Exception('Expected ID attribute!')


            key = ndb.Key('Playlist', int(pl_id))
            pl_obj = key.get()
            descr = pl_obj.description
            tracks = [tr.to_dict() for tr in pl_obj.tracks]
            tracks.sort(key = lambda i: i['index'])
        except Exception, err:
            error = str(err)

        self.response.headers['Content-Type'] = 'application/json'
        self.response.write(json.dumps({'tracks': tracks, 'description': descr, 'error': error}))


class MainPage(webapp2.RequestHandler):
    def get(self):
        template = JINJA_ENVIRONMENT.get_template('index.html')
        self.response.write(template.render({}))
        return

        guestbook_name = self.request.get('album', DEFAULT_ALBUM_NAME)

        html = '''<html><body>
                <input type="text" onclick="search_tracks();"></input>
            </body></html>
        '''
        self.response.write(html)

        tracks = vk.audio.search(q='The Tiger Lillies', sort=SORT_POPULATIRY, count=5, offset=0, performer=SEARCH_ARTIST)
        tracks = tracks[1:]

        for track in tracks:
            html += '<p>%s - %s</p>'%(track['artist'], track['title'])
            
            '''
            track_o = Track()
            ###if users.get_current_user():
            ###    track_o.owner = users.get_current_user()

            track_o.artist = track['artist']
            track_o.title = track['title']
            track_o.aid = track['aid']
            track_o.duration = track['duration']
            track_o.url = track['url']
            track_o.genre = track['genre']
            track_o.put()
            '''

        html += '</body></html>'

        self.response.write(html)


class SearchAudio(webapp2.RequestHandler):
    def get(self):
        try:
            offset = int(self.request.get('offset', 0))
            count = int(self.request.get('count', 20))
            query = self.request.get('query', '')

            if not AUDIO_SEARCHER:
                err = init_searcher()
                if err:
                    raise Exception('Audio searcher are not initialized! %s'%err)

            if not query:
                raise ValueError('Empty query')

            all_count, cur_offset, records = AUDIO_SEARCHER.search(query, offset, count)
            error = None
        except Exception, err:
            error = str(err)
            all_count, cur_offset, records = 0, 0, []

        self.response.headers['Content-Type'] = 'application/json'
        self.response.write(json.dumps({'offset': cur_offset, 'all_count': all_count, \
                                            'tracks': records, 'error':error}))


AUTH_SECRET = ''
q = Config.query(Config.key == 'vk_auth_secret')
config_v = q.fetch(1)
if config_v:
    AUTH_SECRET = config_v[0].value


JINJA_ENVIRONMENT = jinja2.Environment(
    loader=jinja2.FileSystemLoader(os.path.join(os.path.dirname(__file__), 'templates')),
    extensions=['jinja2.ext.autoescape'],
    autoescape=True)

application = webapp2.WSGIApplication([
    ('/', MainPage),
    ('/add_playlist', AddPlaylist),
    ('/mod_playlist', ModPlaylist),
    ('/del_playlist', DelPlaylist),
    ('/get_playlists', GetPlaylists),
    ('/get_playlist_info', GetPlaylistInfo),
    ('/add_to_playlist', AddToPlaylist),
    ('/change_playlist', ChangePlaylist),
    ('/del_track', DelTrack),
    ('/auth', AuthPage)
], debug=True)
