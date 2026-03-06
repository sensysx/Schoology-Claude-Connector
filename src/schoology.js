import crypto from 'crypto';
import OAuth from 'oauth-1.0a';
import fetch from 'node-fetch';

const BASE_URL = 'https://api.schoology.com/v1';

export class SchoologyClient {
  constructor(consumerKey, consumerSecret) {
    if (!consumerKey || !consumerSecret) {
      throw new Error('SCHOOLOGY_CONSUMER_KEY and SCHOOLOGY_CONSUMER_SECRET must be set in .env');
    }
    this.oauth = new OAuth({
      consumer: { key: consumerKey, secret: consumerSecret },
      signature_method: 'HMAC-SHA1',
      hash_function(base_string, key) {
        return crypto.createHmac('sha1', key).update(base_string).digest('base64');
      },
    });
  }

  async request(path) {
    const url = `${BASE_URL}${path}`;
    const authHeader = this.oauth.toHeader(this.oauth.authorize({ url, method: 'GET' }));

    const res = await fetch(url, {
      headers: {
        ...authHeader,
        'Accept': 'application/json',
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
      assignments: course.assignments.filter(
        (a) => a.due && parseInt(a.due) >= now
      ).sort((a, b) => parseInt(a.due) - parseInt(b.due)),
    })).filter((c) => c.assignments.length > 0);
  }
}
