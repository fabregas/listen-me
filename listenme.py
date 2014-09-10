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

from music_search import VKAudioSearcher

class Config(ndb.Model):
    key = ndb.StringProperty(indexed=True)
    value = ndb.StringProperty(indexed=False)

class Track(ndb.Model):
    aid = ndb.IntegerProperty(indexed=True)
    artist = ndb.StringProperty(indexed=True)
    title = ndb.StringProperty(indexed=True)
    duration = ndb.IntegerProperty()
    genre = ndb.IntegerProperty()
    url = ndb.StringProperty(indexed=False)


class Playlist(ndb.Model):
    owner = ndb.UserProperty()
    name = ndb.StringProperty(indexed=False)
    description = ndb.StringProperty(indexed=False)
    date = ndb.DateTimeProperty(auto_now_add=True)
    tracks = ndb.KeyProperty(repeated=True)
    tags = ndb.StringProperty(repeated=True)


DEFAULT_ALBUM_NAME = 'default'

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


class FromDB(webapp2.RequestHandler):
    def get(self):
        tracks_query = Track.query()#.order(-Track.date)
        tracks = tracks_query.fetch(10)

        html = '<html><body>'
        for track in tracks:
            html += '<p>%s - %s <audio src="%s" controls></audio></p>'%(track.artist, track.title, track.url)
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
    ('/indb', FromDB),
    ('/auth', AuthPage)
], debug=True)
