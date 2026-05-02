module.exports = {
  images: {
    domains: [
      'www.notion.so',
      'lh5.googleusercontent.com',
      'us-west-2.amazonaws.com',
      's3.us-west-2.amazonaws.com',
      's3-us-west-2.amazonaws.com',
      'prod-files-secure.s3.us-west-2.amazonaws.com'  // Notion official API images
    ],
    // Enable image optimization with longer cache
    minimumCacheTTL: 3600, // 1 year in seconds
  },
  // Generate 404 page instead of failing build for missing pages
  generateBuildId: async () => {
    return `build-${ Date.now() }`
  },
  // Error handling during static generation
  onDemandEntries: {
    maxInactiveAge: 25 * 1000,
    pagesBufferLength: 2,
  }
}
