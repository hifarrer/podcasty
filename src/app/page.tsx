export default function Home() {
  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[#00c8c8]/10 via-transparent to-[#007bff]/10"></div>
        <div className="relative max-w-7xl mx-auto px-6 py-24 lg:py-32">
          <div className="text-center max-w-4xl mx-auto">
            <h1 className="text-5xl lg:text-7xl font-bold mb-8 gradient-text leading-tight">
              The AI-Powered Podcast Creator
            </h1>
            <p className="text-xl lg:text-2xl text-[#cccccc] mb-12 leading-relaxed">
              Transform any content into polished podcast episodes with natural AI voices, 
              intelligent scripting, and professional audio production.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-16">
              <a href="/create" className="btn-primary text-lg px-8 py-4">
                Create Your First Episode
              </a>
              <a href="/episodes" className="btn-secondary text-lg px-8 py-4">
                View Episodes
              </a>
            </div>
            
            {/* Social Proof */}
            <div className="flex items-center justify-center gap-8 text-[#999999]">
              <div className="flex items-center gap-2">
                <div className="flex text-yellow-400">
                  {[...Array(5)].map((_, i) => (
                    <svg key={i} className="w-5 h-5 fill-current" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  ))}
                </div>
                <span className="font-medium">4.9/5</span>
              </div>
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-[#66cc66]" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span className="font-medium">AI-Powered</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-24 bg-[#222222]">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-white mb-4">
              Everything You Need to Create Amazing Podcasts
            </h2>
            <p className="text-xl text-[#cccccc] max-w-3xl mx-auto">
              From content ingestion to final audio production, we handle every step of the podcast creation process.
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <div className="card group hover:border-[#00c8c8] transition-all duration-300">
              <div className="w-12 h-12 bg-gradient-to-r from-[#00c8c8] to-[#007bff] rounded-lg flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-white mb-3">Smart Content Ingestion</h3>
              <p className="text-[#cccccc] leading-relaxed">
                Import content from YouTube, web pages, PDFs, or text files. Our AI extracts and processes the most relevant information.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="card group hover:border-[#00c8c8] transition-all duration-300">
              <div className="w-12 h-12 bg-gradient-to-r from-[#00c8c8] to-[#007bff] rounded-lg flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-white mb-3">AI Script Generation</h3>
              <p className="text-[#cccccc] leading-relaxed">
                Transform raw content into engaging podcast scripts with natural dialogue, proper pacing, and professional structure.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="card group hover:border-[#00c8c8] transition-all duration-300">
              <div className="w-12 h-12 bg-gradient-to-r from-[#00c8c8] to-[#007bff] rounded-lg flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-white mb-3">Natural Voice Synthesis</h3>
              <p className="text-[#cccccc] leading-relaxed">
                High-quality AI voices that sound natural and engaging. Support for multiple speakers and dialogue formats.
              </p>
            </div>

            {/* Feature 4 */}
            <div className="card group hover:border-[#00c8c8] transition-all duration-300">
              <div className="w-12 h-12 bg-gradient-to-r from-[#00c8c8] to-[#007bff] rounded-lg flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4V2a1 1 0 011-1h8a1 1 0 011 1v2m-9 0h10m-10 0a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V6a2 2 0 00-2-2" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-white mb-3">Professional Audio</h3>
              <p className="text-[#cccccc] leading-relaxed">
                Automatic audio processing, normalization, and chapter markers for broadcast-ready quality.
              </p>
            </div>

            {/* Feature 5 */}
            <div className="card group hover:border-[#00c8c8] transition-all duration-300">
              <div className="w-12 h-12 bg-gradient-to-r from-[#00c8c8] to-[#007bff] rounded-lg flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-white mb-3">RSS Feed Ready</h3>
              <p className="text-[#cccccc] leading-relaxed">
                Automatic RSS feed generation for easy distribution to all major podcast platforms and directories.
              </p>
            </div>

            {/* Feature 6 */}
            <div className="card group hover:border-[#00c8c8] transition-all duration-300">
              <div className="w-12 h-12 bg-gradient-to-r from-[#00c8c8] to-[#007bff] rounded-lg flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-white mb-3">Customizable Options</h3>
              <p className="text-[#cccccc] leading-relaxed">
                Choose from multiple modes, voices, and formatting options to create the perfect episode for your audience.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24">
        <div className="max-w-4xl mx-auto text-center px-6">
          <h2 className="text-4xl font-bold text-white mb-6">
            Ready to Create Your First AI Podcast?
          </h2>
          <p className="text-xl text-[#cccccc] mb-12">
            Join thousands of creators who are already using Podcasty to produce professional-quality content.
          </p>
          <a href="/create" className="btn-primary text-xl px-12 py-6">
            Start Creating Now
          </a>
        </div>
      </section>
    </div>
  );
}
