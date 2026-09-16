/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // The app runs entirely in the browser — parsing, analytics and export all
  // happen client-side, and there are no API routes or server components that
  // need a Node runtime. Exporting to static HTML lets it be hosted on
  // Netlify Drop, GitHub Pages, or any plain file host.
  output: "export",

  // Static hosts resolve /path to /path/index.html, so emit directories.
  trailingSlash: true,

  images: {
    // No image optimisation server exists in a static export.
    unoptimized: true,
  },
};

module.exports = nextConfig;
