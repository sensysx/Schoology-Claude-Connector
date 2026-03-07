import pkg from 'oauth';
import fetch from 'node-fetch';

const { OAuth } = pkg;

const BASE_URL = process.env.SCHOOLOGY_BASE_URL || 'https://api.schoology.com/v1';

export class SchoologyClient {
  constructor(consumerKey, consumerSecret) {
    if (!consumerKey || !consumerSecret) {
      throw new Error('SCHOOLOGY_CONSUMER_KEY and SCHOOLOGY_CONSUMER_SECRET must be set in .env');
    }
    this.oauth = new OAuth(
      null, null,
      consumerKey.trim(),
      consumerSecret.trim(),
      '1.0',
      null,
      'HMAC-SHA1'
    );
  }

  async signedFetch(url) {
    const params = this.oauth._prepareParameters(null, null, 'GET', url, null);
    const authHeader = this.oauth._buildAuthorizationHeaders(params);
    return fetch(url, {
      redirect: 'manual',
      headers: { Authorization: authHeader, Accept: 'application/json' },
    });
  }

  async request(path) {
    const url = `${BASE_URL}${path}`;
    let res = await this.signedFetch(url);

    // Follow redirects with a fresh signed request
    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get('location');
      res = await this.signedFetch(location);
    }

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Schoology API ${res.status}: ${text.slice(0, 300)}`);
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
