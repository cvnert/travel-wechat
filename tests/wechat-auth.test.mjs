import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

function loadWechatAuth({ api = {}, wx = {} } = {}) {
  const filename = path.join(__dirname, '../utils/wechat-auth.js')
  const code = fs.readFileSync(filename, 'utf8')
  const module = { exports: {} }
  const sandbox = {
    module,
    exports: module.exports,
    require(id) {
      const normalizedId = id.replace(/\.js$/, '')
      if (normalizedId === './api') {
        return api
      }
      throw new Error(`unexpected require: ${id}`)
    },
    wx: {
      login() {},
      getUserProfile() {},
      ...wx
    }
  }

  vm.runInNewContext(code, sandbox, { filename })
  return module.exports
}

test('loginWithWechat authenticates even when profile consent is denied', async () => {
  let wechatLoginCode = ''
  let updateCalled = false
  const auth = loadWechatAuth({
    api: {
      wechatLogin(code) {
        wechatLoginCode = code
        return Promise.resolve({
          token: 'token-value',
          user: {
            nickname: 'Guest'
          }
        })
      },
      updateWechatProfile() {
        updateCalled = true
        return Promise.resolve({
          user: {
            nickname: 'Updated'
          }
        })
      }
    },
    wx: {
      login(options) {
        options.success({ code: 'code-123' })
      },
      getUserProfile(options) {
        options.fail({ errMsg: 'getUserProfile:fail auth deny' })
      }
    }
  })

  const result = await auth.loginWithWechat('profile description')

  assert.equal(wechatLoginCode, 'code-123')
  assert.equal(updateCalled, false)
  assert.equal(result.token, 'token-value')
  assert.deepEqual(JSON.parse(JSON.stringify(result.user)), {
    nickname: 'Guest'
  })
  assert.equal(result.profileDenied, true)
})

test('loginWithWechat syncs user profile after login when consent is granted', async () => {
  const calls = []
  const auth = loadWechatAuth({
    api: {
      wechatLogin(code) {
        calls.push(['login', code])
        return Promise.resolve({
          token: 'token-value',
          user: {
            nickname: 'Guest',
            avatarUrl: ''
          }
        })
      },
      updateWechatProfile(profile) {
        calls.push(['profile', profile])
        return Promise.resolve({
          user: {
            nickname: 'Traveler',
            avatarUrl: 'https://example.com/avatar.png'
          }
        })
      }
    },
    wx: {
      login(options) {
        options.success({ code: 'code-123' })
      },
      getUserProfile(options) {
        options.success({
          userInfo: {
            nickName: 'Traveler',
            avatarUrl: 'https://wx.example.com/avatar.png',
            gender: 1,
            country: 'CN',
            province: 'Zhejiang',
            city: 'Hangzhou',
            language: 'zh_CN'
          }
        })
      }
    }
  })

  const result = await auth.loginWithWechat('profile description')

  assert.deepEqual(JSON.parse(JSON.stringify(calls)), [
    ['login', 'code-123'],
    ['profile', {
      nickName: 'Traveler',
      avatarUrl: 'https://wx.example.com/avatar.png',
      gender: 1,
      country: 'CN',
      province: 'Zhejiang',
      city: 'Hangzhou',
      language: 'zh_CN'
    }]
  ])
  assert.equal(result.profileDenied, false)
  assert.deepEqual(JSON.parse(JSON.stringify(result.user)), {
    nickname: 'Traveler',
    avatarUrl: 'https://example.com/avatar.png'
  })
})
