// All production URL consumers use this value; internal links stay relative.
export const SITE_URL = 'https://cangxinge.xyz';

export const site = {
  name: 'NOTE',
  description: '个人技术笔记',
  copyrightYear: 2026,
  url: SITE_URL,
  hostname: new URL(SITE_URL).hostname,
  cloudflare: {
    projectName: 'cangxinge-notes',
    productionBranch: 'main',
    previewBranch: 'preview',
    outputDirectory: 'dist',
  },
};

// Initial categories for the local preview; Supabase will own these after setup.
export const categories = [
  { directory: 'java', text: 'JAVA' },
  { directory: 'database', text: '数据库' },
  { directory: 'embedded', text: '嵌入式' },
  { directory: 'design-pattern', text: '设计模式' },
];
