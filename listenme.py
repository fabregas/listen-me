import os
import cgi
import urllib

from google.appengine.api import users
from google.appengine.ext import ndb

import webapp2
import jinja2

from music_search import *

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



JINJA_ENVIRONMENT = jinja2.Environment(
    loader=jinja2.FileSystemLoader(os.path.join(os.path.dirname(__file__), 'templates')),
    extensions=['jinja2.ext.autoescape'],
    autoescape=True)

application = webapp2.WSGIApplication([
    ('/', MainPage),
    ('/indb', FromDB),
], debug=True)
