import axios from 'axios';

async function testParsePosts() {
  const url = 'https://www.youtube.com/@techvaseegrah/posts';
  console.log('Fetching:', url);

  const response = await axios.get(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept-Language': 'en-US,en;q=0.9',
    }
  });

  const html = response.data;
  const match = html.match(/var ytInitialData = ({.*?});/s) || html.match(/window\["ytInitialData"\] = ({.*?});/s);
  const json = JSON.parse(match[1]);
  const tabs = json.contents?.twoColumnBrowseResultsRenderer?.tabs || [];
  const postsTab = tabs.find(t => t.tabRenderer?.title === 'Posts' || t.tabRenderer?.title === 'Community' || t.tabRenderer?.selected);

  if (!postsTab) {
    console.log('No posts tab found');
    return;
  }

  const contents = postsTab.tabRenderer?.content?.sectionListRenderer?.contents?.[0]?.itemSectionRenderer?.contents || [];
  console.log('itemSectionRenderer contents count:', contents.length);

  const posts = [];
  for (const item of contents) {
    const postRenderer = item.backstagePostThreadRenderer?.post?.backstagePostRenderer || item.sharedPostRenderer;
    if (postRenderer) {
      const postId = postRenderer.postId;
      const author = postRenderer.authorText?.runs?.[0]?.text;
      const text = postRenderer.contentText?.runs?.map(r => r.text).join('') || '';
      const publishedTime = postRenderer.publishedTimeText?.runs?.[0]?.text;
      posts.push({ postId, author, text, publishedTime });
    }
  }

  console.log(`Found ${posts.length} posts:`);
  posts.forEach((p, i) => {
    console.log(`\n[Post ${i + 1}] ID: ${p.postId}`);
    console.log(` Author: ${p.author}`);
    console.log(` Text: "${p.text}"`);
    console.log(` Published: ${p.publishedTime}`);
  });
}

testParsePosts().catch(console.error);
