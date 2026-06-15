const fs = require('fs');
const path = require('path');
const https = require('https');
const { exec } = require('child_process');

/**
 * UpdateService
 *
 * Handles version reporting and update detection for two distribution modes:
 *
 *  1. "git"     - The app was cloned from GitHub (a .git folder exists next to
 *                 the app). Updates are detected by comparing the local HEAD
 *                 commit against the latest commit on the main branch via the
 *                 GitHub API. Updating runs `git pull`.
 *
 *  2. "release" - The app was downloaded as a packaged release. Updates are
 *                 detected by comparing the bundled package version against the
 *                 latest GitHub Release tag in the NeuroDB-releases repo.
 *                 Updating opens the release download page in the browser.
 */
class UpdateService {
  constructor(configService, appRoot) {
    this.configService = configService;
    // Root of the application source (where package.json / .git live)
    this.appRoot = appRoot || path.join(__dirname, '..');

    // Source repository (cloned-repo mode)
    this.sourceRepo = { owner: 'Omzee15', name: 'NeuroDB', branch: 'main' };
    // Releases repository (packaged-release mode)
    this.releaseRepo = { owner: 'Omzee15', name: 'NeuroDB-releases' };

    this.pkg = this.loadPackageJson();
  }

  loadPackageJson() {
    try {
      const data = fs.readFileSync(path.join(this.appRoot, 'package.json'), 'utf8');
      return JSON.parse(data);
    } catch (e) {
      return { version: '0.0.0' };
    }
  }

  // --- mode detection ----------------------------------------------------

  isGitClone() {
    try {
      return fs.existsSync(path.join(this.appRoot, '.git'));
    } catch (e) {
      return false;
    }
  }

  getMode() {
    return this.isGitClone() ? 'git' : 'release';
  }

  // --- local state -------------------------------------------------------

  /**
   * Returns the local HEAD commit SHA and its date (git mode only).
   */
  getLocalCommit() {
    return new Promise((resolve) => {
      exec(
        'git rev-parse HEAD && git show -s --format=%cI HEAD',
        { cwd: this.appRoot },
        (err, stdout) => {
          if (err) {
            resolve(null);
            return;
          }
          const lines = stdout.trim().split('\n');
          resolve({ sha: (lines[0] || '').trim(), date: (lines[1] || '').trim() });
        }
      );
    });
  }

  /**
   * "Downloaded date" for a release build. We record the first time this
   * version was seen on this machine and reuse it thereafter.
   */
  getInstallDate() {
    const key = `installDate_${this.pkg.version}`;
    let stored = this.configService.get(key);
    if (!stored) {
      stored = new Date().toISOString();
      this.configService.set(key, stored);
    }
    return stored;
  }

  // --- GitHub API helper -------------------------------------------------

  ghRequest(pathName) {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: 'api.github.com',
        path: pathName,
        method: 'GET',
        headers: {
          'User-Agent': 'NeuroDB-App',
          Accept: 'application/vnd.github+json',
        },
      };
      const req = https.request(options, (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            try {
              resolve(JSON.parse(body));
            } catch (e) {
              reject(new Error('Failed to parse GitHub response'));
            }
          } else {
            reject(new Error(`GitHub API ${res.statusCode}: ${body.slice(0, 200)}`));
          }
        });
      });
      req.on('error', reject);
      req.setTimeout(15000, () => req.destroy(new Error('GitHub request timed out')));
      req.end();
    });
  }

  // --- version info (for the Settings panel) -----------------------------

  async getVersionInfo() {
    const mode = this.getMode();
    const info = {
      mode,
      version: this.pkg.version,
      productName: (this.pkg.build && this.pkg.build.productName) || 'NeuroDB',
    };

    if (mode === 'git') {
      const local = await this.getLocalCommit();
      info.commitSha = local ? local.sha : null;
      info.commitShortSha = local && local.sha ? local.sha.slice(0, 7) : null;
      info.lastUpdated = local ? local.date : null; // date of the pulled commit
    } else {
      info.installDate = this.getInstallDate();
    }
    return info;
  }

  // --- update checks -----------------------------------------------------

  async checkForUpdates() {
    if (this.getMode() === 'git') {
      return this.checkGitUpdates();
    }
    return this.checkReleaseUpdates();
  }

  async checkGitUpdates() {
    const local = await this.getLocalCommit();
    if (!local || !local.sha) {
      return { mode: 'git', updateAvailable: false, error: 'Could not read local git commit.' };
    }

    const { owner, name, branch } = this.sourceRepo;
    const remote = await this.ghRequest(`/repos/${owner}/${name}/commits/${branch}`);
    const remoteSha = remote.sha;
    const remoteDate =
      remote.commit && remote.commit.committer ? remote.commit.committer.date : null;

    const updateAvailable = remoteSha && remoteSha !== local.sha;

    let behindBy = null;
    if (updateAvailable) {
      try {
        const cmp = await this.ghRequest(
          `/repos/${owner}/${name}/compare/${local.sha}...${remoteSha}`
        );
        behindBy = cmp.ahead_by != null ? cmp.ahead_by : null;
      } catch (e) {
        // comparison is best-effort
      }
    }

    return {
      mode: 'git',
      updateAvailable: !!updateAvailable,
      localSha: local.sha,
      localShortSha: local.sha.slice(0, 7),
      remoteSha,
      remoteShortSha: remoteSha ? remoteSha.slice(0, 7) : null,
      remoteDate,
      behindBy,
      latestMessage: remote.commit ? remote.commit.message.split('\n')[0] : null,
    };
  }

  async checkReleaseUpdates() {
    const { owner, name } = this.releaseRepo;
    let latest;
    try {
      latest = await this.ghRequest(`/repos/${owner}/${name}/releases/latest`);
    } catch (e) {
      return { mode: 'release', updateAvailable: false, error: e.message };
    }

    const latestTag = (latest.tag_name || '').replace(/^v/i, '');
    const current = this.pkg.version;
    const updateAvailable = !!latestTag && this.compareVersions(latestTag, current) > 0;

    return {
      mode: 'release',
      updateAvailable,
      currentVersion: current,
      latestVersion: latestTag,
      latestName: latest.name || latest.tag_name,
      releaseNotes: latest.body || '',
      releaseUrl: latest.html_url,
      publishedAt: latest.published_at,
    };
  }

  /**
   * Returns 1 if a > b, -1 if a < b, 0 if equal. Semver-ish numeric compare.
   */
  compareVersions(a, b) {
    const pa = String(a).split('.').map((n) => parseInt(n, 10) || 0);
    const pb = String(b).split('.').map((n) => parseInt(n, 10) || 0);
    const len = Math.max(pa.length, pb.length);
    for (let i = 0; i < len; i++) {
      const x = pa[i] || 0;
      const y = pb[i] || 0;
      if (x > y) return 1;
      if (x < y) return -1;
    }
    return 0;
  }

  // --- applying updates (git mode) ---------------------------------------

  /**
   * Runs `git pull` in the app root. Returns the new commit info on success.
   */
  applyGitUpdate() {
    return new Promise((resolve) => {
      exec(
        'git pull --ff-only',
        { cwd: this.appRoot, timeout: 120000 },
        (err, stdout, stderr) => {
          if (err) {
            resolve({
              success: false,
              error: (stderr || err.message || '').trim(),
            });
            return;
          }
          resolve({ success: true, output: (stdout || '').trim() });
        }
      );
    });
  }
}

module.exports = UpdateService;
