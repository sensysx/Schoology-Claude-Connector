import crypto from 'crypto';
import fetch from 'node-fetch';

const BASE_URL = process.env.SCHOOLOGY_BASE_URL || 'https://api.schoology.com/v1';

export class SchoologyClient {
  constructor(consumerKey, consumerSecret) {
    if (!consumerKey || !consumerSecret) {
      throw new Error('SCHOOLOGY_CONSUMER_KEY and SCHOOLOGY_CONSUMER_SECRET must be set in .env');
    }
    this.consumerKey = consumerKey.trim();
    this.consumerSecret = consumerSecret.trim();
  }

  buildAuthHeader(url) {
    const nonce = crypto.randomBytes(16).toString('hex');
    const timestamp = Math.floor(Date.now() / 1000).toString();

    const params = {
      oauth_consumer_key: this.consumerKey,
      oauth_nonce: nonce,
      oauth_signature_method: 'HMAC-SHA1',
      oauth_timestamp: timestamp,
      oauth_version: '1.0',
    };

    const paramString = Object.keys(params)
      .sort()
      .map(k => `${encodeURIComponent(k)}=${encodeURIComponent(params[k])}`)
      .join('&');

    const baseString = `GET&${encodeURIComponent(url)}&${encodeURIComponent(paramString)}`;
    const signingKey = `${encodeURIComponent(this.consumerSecret)}&`;
    const signature = crypto.createHmac('sha1', signingKey).update(baseString).digest('base64');

    const headerParams = { ...params, oauth_signature: signature };
    const authHeader = 'OAuth ' + Object.entries(headerParams)
      .map(([k, v]) => `${k}="${v}"`)
      .join(', ');

    console.log('[OAuth] url:', url);
    console.log('[OAuth] timestamp:', timestamp);
    console.log('[OAuth] nonce:', nonce);
    console.log('[OAuth] signature:', signature);
    console.log('[OAuth] header:', authHeader);

    return authHeader;
  }

  async request(path) {
    const url = `${BASE_URL}${path}`;

    const res = await fetch(url, {
      headers: {
        Authorization: this.buildAuthHeader(url),
        Accept: 'application/json',
      },
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Schoology API ${res.status}: ${text}`);
    }

    return res.json();
  }

  async getMe() {
    return this.request('/users/me');
  }

  async getSections() {
    const me = await this.getMe();
    const data = await this.request(`/users/${me.id}/sections`);
    return data.section || [];
  }

  async getAssignments(sectionId) {
    const data = await this.request(`/sections/${sectionId}/assignments`);
    return data.assignment || [];
  }

  async getAllAssignments() {
    const sections = await this.getSections();
    const results = await Promise.all(
      sections.map(async (section) => {
        const assignments = await this.getAssignments(section.id);
        return {
          course_title: section.course_title,
          section_title: section.section_title,
          section_id: section.id,
          assignments,
        };
      })
    );
    return results;
  }

  async getUpcomingAssignments() {
    const all = await this.getAllAssignments();
    const now = Date.now() / 1000;
    return all.map((course) => ({
      ...course,
      assignments: course.assignments
        .filter(a => a.due && parseInt(a.due) >= now)
        .sort((a, b) => parseInt(a.due) - parseInt(b.due)),
    })).filter(c => c.assignments.length > 0);
  }
}
