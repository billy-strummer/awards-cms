/**
 * @module social-media-api
 * Social Media API Connector.
 * Server-side integration with Twitter/X, LinkedIn,
 * Facebook, and Instagram APIs.
 */

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

// ==========================================
// Twitter/X API v2
// ==========================================

/**
 * Post a tweet to Twitter/X via the v2 API.
 * @param {string} content - The text content of the tweet.
 * @param {string|null} [imageUrl=null] - Optional image URL to attach.
 * @returns {Promise<{platform: string, postId: string, url: string}>} The posted tweet details.
 * @throws {Error} If the Twitter API token is not configured or the API returns an error.
 */
async function postToTwitter(content, imageUrl = null) {
  const token = process.env.TWITTER_BEARER_TOKEN;
  if (!token) throw new Error('Twitter API token not configured');

  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  let mediaId = null;
  if (imageUrl) {
    mediaId = await uploadTwitterMedia(imageUrl, token);
  }

  const body = { text: content };
  if (mediaId) {
    body.media = { media_ids: [mediaId] };
  }

  const res = await fetch('https://api.twitter.com/2/tweets', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(`Twitter API error: ${err.detail || res.statusText}`);
  }

  const data = await res.json();
  return { platform: 'twitter', postId: data.data.id, url: `https://x.com/i/status/${data.data.id}` };
}

/**
 * Upload media to Twitter via the v1.1 media upload endpoint.
 * @param {string} imageUrl - The URL of the image to upload.
 * @param {string} token - Twitter bearer token for authentication.
 * @returns {Promise<string>} The media ID string for use in tweets.
 * @throws {Error} If the media upload fails.
 */
async function uploadTwitterMedia(imageUrl, token) {
  // Download image
  const imgRes = await fetch(imageUrl);
  const buffer = Buffer.from(await imgRes.arrayBuffer());
  const base64 = buffer.toString('base64');

  // Upload via v1.1 media endpoint (still required for v2 tweets)
  const uploadRes = await fetch('https://upload.twitter.com/1.1/media/upload.json', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: `media_data=${encodeURIComponent(base64)}`,
  });

  if (!uploadRes.ok) throw new Error('Failed to upload media to Twitter');
  const uploadData = await uploadRes.json();
  return uploadData.media_id_string;
}

// ==========================================
// LinkedIn API v2
// ==========================================

/**
 * Post content to a LinkedIn organisation page via the UGC API.
 * @param {string} content - The text content of the post.
 * @param {string|null} [imageUrl=null] - Optional image URL to attach.
 * @returns {Promise<{platform: string, postId: string, url: string}>} The posted content details.
 * @throws {Error} If LinkedIn API credentials are not configured or the API returns an error.
 */
async function postToLinkedIn(content, imageUrl = null) {
  const accessToken = process.env.LINKEDIN_ACCESS_TOKEN;
  const orgId = process.env.LINKEDIN_ORG_ID;
  if (!accessToken || !orgId) throw new Error('LinkedIn API credentials not configured');

  const headers = {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
    'X-Restli-Protocol-Version': '2.0.0',
  };

  let imageAsset = null;
  if (imageUrl) {
    imageAsset = await uploadLinkedInImage(imageUrl, accessToken, orgId);
  }

  const body = {
    author: `urn:li:organization:${orgId}`,
    lifecycleState: 'PUBLISHED',
    specificContent: {
      'com.linkedin.ugc.ShareContent': {
        shareCommentary: { text: content },
        shareMediaCategory: imageAsset ? 'IMAGE' : 'NONE',
        ...(imageAsset && {
          media: [
            {
              status: 'READY',
              media: imageAsset,
            },
          ],
        }),
      },
    },
    visibility: {
      'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC',
    },
  };

  const res = await fetch('https://api.linkedin.com/v2/ugcPosts', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`LinkedIn API error: ${err}`);
  }

  const data = await res.json();
  return { platform: 'linkedin', postId: data.id, url: `https://www.linkedin.com/feed/update/${data.id}` };
}

/**
 * Upload an image to LinkedIn for use in a post.
 * @param {string} imageUrl - The URL of the image to download and re-upload.
 * @param {string} accessToken - LinkedIn OAuth access token.
 * @param {string} orgId - LinkedIn organisation ID.
 * @returns {Promise<string>} The LinkedIn asset URN for the uploaded image.
 */
async function uploadLinkedInImage(imageUrl, accessToken, orgId) {
  // Register upload
  const registerRes = await fetch('https://api.linkedin.com/v2/assets?action=registerUpload', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      registerUploadRequest: {
        recipes: ['urn:li:digitalmediaRecipe:feedshare-image'],
        owner: `urn:li:organization:${orgId}`,
        serviceRelationships: [
          {
            relationshipType: 'OWNER',
            identifier: 'urn:li:userGeneratedContent',
          },
        ],
      },
    }),
  });

  const regData = await registerRes.json();
  const uploadUrl =
    regData.value.uploadMechanism['com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest'].uploadUrl;
  const asset = regData.value.asset;

  // Download and re-upload image
  const imgRes = await fetch(imageUrl);
  const buffer = Buffer.from(await imgRes.arrayBuffer());

  await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'image/png',
    },
    body: buffer,
  });

  return asset;
}

// ==========================================
// Facebook Graph API
// ==========================================

/**
 * Post content to a Facebook page via the Graph API.
 * @param {string} content - The text content of the post.
 * @param {string|null} [imageUrl=null] - Optional image URL to attach as a photo post.
 * @returns {Promise<{platform: string, postId: string, url: string}>} The posted content details.
 * @throws {Error} If Facebook API credentials are not configured or the API returns an error.
 */
async function postToFacebook(content, imageUrl = null) {
  const pageToken = process.env.FACEBOOK_PAGE_TOKEN;
  const pageId = process.env.FACEBOOK_PAGE_ID;
  if (!pageToken || !pageId) throw new Error('Facebook API credentials not configured');

  let endpoint, body;

  if (imageUrl) {
    endpoint = `https://graph.facebook.com/v18.0/${pageId}/photos`;
    body = new URLSearchParams({
      message: content,
      url: imageUrl,
      access_token: pageToken,
    });
  } else {
    endpoint = `https://graph.facebook.com/v18.0/${pageId}/feed`;
    body = new URLSearchParams({
      message: content,
      access_token: pageToken,
    });
  }

  const res = await fetch(endpoint, {
    method: 'POST',
    body,
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(`Facebook API error: ${err.error?.message || res.statusText}`);
  }

  const data = await res.json();
  return { platform: 'facebook', postId: data.id, url: `https://facebook.com/${data.id}` };
}

// ==========================================
// Instagram Graph API (via Facebook)
// ==========================================

/**
 * Post an image with caption to Instagram via the Facebook Graph API.
 * @param {string} content - The caption text for the Instagram post.
 * @param {string} imageUrl - The publicly accessible image URL (required for Instagram).
 * @returns {Promise<{platform: string, postId: string, url: string}>} The posted content details.
 * @throws {Error} If Instagram API credentials are not configured, no image is provided, or the API returns an error.
 */
async function postToInstagram(content, imageUrl) {
  const accessToken = process.env.FACEBOOK_PAGE_TOKEN;
  const igAccountId = process.env.INSTAGRAM_ACCOUNT_ID;
  if (!accessToken || !igAccountId) throw new Error('Instagram API credentials not configured');
  if (!imageUrl) throw new Error('Instagram requires an image');

  // Step 1: Create media container
  const containerRes = await fetch(`https://graph.facebook.com/v18.0/${igAccountId}/media`, {
    method: 'POST',
    body: new URLSearchParams({
      image_url: imageUrl,
      caption: content,
      access_token: accessToken,
    }),
  });

  if (!containerRes.ok) {
    const err = await containerRes.json();
    throw new Error(`Instagram API error: ${err.error?.message || containerRes.statusText}`);
  }

  const container = await containerRes.json();

  // Step 2: Publish media container
  const publishRes = await fetch(`https://graph.facebook.com/v18.0/${igAccountId}/media_publish`, {
    method: 'POST',
    body: new URLSearchParams({
      creation_id: container.id,
      access_token: accessToken,
    }),
  });

  if (!publishRes.ok) {
    const err = await publishRes.json();
    throw new Error(`Instagram publish error: ${err.error?.message}`);
  }

  const data = await publishRes.json();
  return { platform: 'instagram', postId: data.id, url: `https://instagram.com/p/${data.id}` };
}

// ==========================================
// Unified publish handler
// ==========================================

/**
 * Publish a social media post to all configured platforms.
 * Reads the post from the database and dispatches to each platform handler.
 * @param {string} postId - The ID of the social_media_posts record to publish.
 * @returns {Promise<{results: Array, errors: Array, status: string}>} Aggregated results and errors from all platforms.
 * @throws {Error} If the post is not found in the database.
 */
async function publishToSocialMedia(postId) {
  const { data: post, error } = await supabase.from('social_media_posts').select('*').eq('id', postId).single();

  if (error || !post) throw new Error('Post not found');

  const results = [];
  const errors = [];

  for (const platform of post.platforms) {
    const content = post.platform_content?.[platform] || post.content;
    try {
      let result;
      switch (platform) {
        case 'twitter':
          result = await postToTwitter(content, post.image_url);
          break;
        case 'linkedin':
          result = await postToLinkedIn(content, post.image_url);
          break;
        case 'facebook':
          result = await postToFacebook(content, post.image_url);
          break;
        case 'instagram':
          result = await postToInstagram(content, post.image_url);
          break;
        default:
          throw new Error(`Unsupported platform: ${platform}`);
      }
      results.push(result);
    } catch (e) {
      errors.push({ platform, error: e.message });
    }
  }

  // Update post with results
  const status = errors.length === 0 ? 'published' : results.length > 0 ? 'partial' : 'failed';
  await supabase
    .from('social_media_posts')
    .update({
      status,
      published_at: new Date().toISOString(),
      publish_results: results,
      publish_errors: errors.length > 0 ? errors : null,
    })
    .eq('id', postId);

  return { results, errors, status };
}

// ==========================================
// Scheduled post processor (call via cron)
// ==========================================

/**
 * Process all scheduled posts that are due for publishing.
 * Intended to be called via a cron job.
 * @returns {Promise<{processed: number}>} The count of posts successfully processed.
 */
async function processScheduledPosts() {
  const now = new Date().toISOString();

  const { data: posts, error } = await supabase
    .from('social_media_posts')
    .select('id')
    .eq('status', 'scheduled')
    .lte('scheduled_for', now);

  if (error || !posts) return { processed: 0 };

  let processed = 0;
  for (const post of posts) {
    try {
      await publishToSocialMedia(post.id);
      processed++;
    } catch (e) {
      console.error(`Failed to process scheduled post ${post.id}:`, e.message);
    }
  }

  return { processed };
}

module.exports = {
  postToTwitter,
  postToLinkedIn,
  postToFacebook,
  postToInstagram,
  publishToSocialMedia,
  processScheduledPosts,
};
