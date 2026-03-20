import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { Video } from '../types';
import { Play, Search, Filter, Clock, Share2, Bookmark, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function VideoGallery() {
  const [videos, setVideos] = useState<Video[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null);

  useEffect(() => {
    fetchVideos();
  }, []);

  const fetchVideos = async () => {
    setIsLoading(true);
    try {
      const q = query(collection(db, 'videos'), orderBy('createdAt', 'desc'));
      const snap = await getDocs(q);
      setVideos(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Video)));
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const categories = ['All', ...new Set(videos.map(v => v.category).filter(Boolean))];

  const filteredVideos = videos.filter(v => {
    const matchesSearch = v.title.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'All' || v.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const getEmbedUrl = (url: string) => {
    if (url.includes('youtube.com') || url.includes('youtu.be')) {
      const id = url.split('v=')[1] || url.split('/').pop();
      return `https://www.youtube.com/embed/${id}`;
    }
    if (url.includes('vimeo.com')) {
      const id = url.split('/').pop();
      return `https://player.vimeo.com/video/${id}`;
    }
    return url;
  };

  return (
    <div className="space-y-4 md:space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-center gap-6">
        <div>
          <h2 className="text-3xl font-bold text-stone-900">Video Gallery</h2>
          <p className="text-stone-500 font-medium italic">Educational and inspirational Islamic content.</p>
        </div>
        <div className="relative w-full md:w-96">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-400" />
          <input
            type="text"
            placeholder="Search videos..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white border border-stone-200 rounded-2xl pl-12 pr-6 py-4 text-sm focus:ring-2 focus:ring-emerald-600 outline-none shadow-sm transition-all"
          />
        </div>
      </div>

      {/* Categories */}
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat as string)}
            className={`px-6 py-2 rounded-full text-xs font-bold uppercase tracking-widest transition-all whitespace-nowrap ${
              selectedCategory === cat 
                ? 'bg-emerald-900 text-white shadow-lg' 
                : 'bg-white text-stone-500 border border-stone-200 hover:border-emerald-200'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4 text-stone-400">
          <div className="w-12 h-12 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="font-medium animate-pulse">Loading gallery...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {filteredVideos.map((video) => (
            <motion.div
              key={video.id}
              whileHover={{ y: -5 }}
              className="bg-white rounded-3xl border border-stone-100 shadow-sm hover:shadow-xl transition-all overflow-hidden group cursor-pointer"
              onClick={() => setSelectedVideo(video)}
            >
              <div className="aspect-video bg-stone-100 relative overflow-hidden">
                {video.thumbnail ? (
                  <img src={video.thumbnail} className="w-full h-full object-cover group-hover:scale-105 transition-all duration-500" alt="" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-emerald-50 text-emerald-600">
                    <Play className="w-12 h-12 opacity-20" />
                  </div>
                )}
                <div className="absolute inset-0 bg-black/20 group-hover:bg-black/40 transition-all flex items-center justify-center">
                  <div className="w-14 h-14 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center text-white scale-90 group-hover:scale-100 transition-all">
                    <Play className="w-6 h-6 fill-current" />
                  </div>
                </div>
                <div className="absolute bottom-3 right-3 bg-black/60 backdrop-blur-md text-white text-[10px] px-2 py-1 rounded-md font-bold">
                  {video.category || 'General'}
                </div>
              </div>
              <div className="p-6 space-y-3">
                <h3 className="font-bold text-lg text-stone-900 line-clamp-2 group-hover:text-emerald-900 transition-all">
                  {video.title}
                </h3>
                <div className="flex items-center justify-between text-[10px] text-stone-400 font-bold uppercase tracking-widest">
                  <div className="flex items-center gap-2">
                    <Clock className="w-3 h-3" />
                    {new Date(video.createdAt).toLocaleDateString()}
                  </div>
                  <div className="flex items-center gap-3">
                    <Share2 className="w-3 h-3 hover:text-emerald-600" />
                    <Bookmark className="w-3 h-3 hover:text-emerald-600" />
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {filteredVideos.length === 0 && !isLoading && (
        <div className="py-20 text-center text-stone-400">
          <Info className="w-16 h-16 mx-auto mb-4 opacity-20" />
          <p className="font-medium italic">No videos found matching your search.</p>
        </div>
      )}

      {/* Video Player Modal */}
      <AnimatePresence>
        {selectedVideo && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/90 backdrop-blur-md"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-5xl overflow-hidden flex flex-col"
            >
              <div className="aspect-video w-full bg-black">
                <iframe
                  src={getEmbedUrl(selectedVideo.url)}
                  className="w-full h-full"
                  allowFullScreen
                  title={selectedVideo.title}
                ></iframe>
              </div>
              <div className="p-8 space-y-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-2xl font-bold text-stone-900">{selectedVideo.title}</h3>
                    <p className="text-xs text-stone-400 font-bold uppercase tracking-widest mt-1">
                      {selectedVideo.category} · Added {new Date(selectedVideo.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <button 
                    onClick={() => setSelectedVideo(null)}
                    className="p-3 bg-stone-100 text-stone-600 rounded-2xl hover:bg-red-600 hover:text-white transition-all shadow-inner"
                  >
                    Close Player
                  </button>
                </div>
                <p className="text-stone-600 leading-relaxed">
                  {selectedVideo.description || 'No description provided for this video.'}
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
