
import vkontakte

class AbstractAudioSearcher(object):
    def __init__(self, auth_token):
        super(AbstractAudioSearcher, self).__init__()
        self._token = auth_token

    def search(self, query, offset=0, count=20):
        '''
        return <all count>, <ret count>, <cur offset>, <records>
        '''
        pass

    def get_by_id(self, track_id):
        pass

    def get_lyrics(self, track_id):
        pass



class VKAudioSearcher(AbstractAudioSearcher):
    SORT_POPULATIRY = 2

    SEARCH_ARTIST = 1
    SEARCH_ALL = 0

    def __init__(self, auth_token):
        super(VKAudioSearcher, self).__init__(auth_token)

        self.__vk = vkontakte.API(token=auth_token)

    
    def search(self, query, offset=0, count=20):
        '''
        return <all count>, <cur offset>, <records>
        '''
        ret_records = []
        ret_offset = offset
        _cache = {}

        while True:
            raw = self.__vk.audio.search(q=query, sort=self.SORT_POPULATIRY, count=count, offset=ret_offset, performer=self.SEARCH_ARTIST)
            all_count = raw[0]
            records = raw[1:]
            if len(records) == 0:
                break
            ret_offset += len(records)
            for rec in records:
                if (rec['duration'], rec['title'], rec['artist']) in _cache:
                    continue
                ret_records.append(rec)
                _cache[(rec['duration'], rec['title'], rec['artist'])] = None

            if len(ret_records) >= count:
                break

        return all_count, ret_offset, ret_records 
