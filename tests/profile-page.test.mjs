import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

function loadProfilePage({ api = {}, wechatAuth = {}, wx = {} } = {}) {
  const filename = path.join(__dirname, '../pages/profile/index.js')
  const code = fs.readFileSync(filename, 'utf8')
  let pageConfig = null
  const sandbox = {
    require(id) {
      const normalizedId = id.replace(/\.js$/, '')
      if (normalizedId === '../../utils/api') {
        return api
      }
      if (normalizedId === '../../utils/wechat-auth') {
        return wechatAuth
      }
      throw new Error(`unexpected require: ${id}`)
    },
    Page(config) {
      pageConfig = config
    },
    wx: {
      getStorageSync() {
        return ''
      },
      showToast() {},
      setStorageSync() {},
      removeStorageSync() {},
      showModal() {},
      ...wx
    },
    console
  }

  vm.runInNewContext(code, sandbox, { filename })

  const instance = {
    data: JSON.parse(JSON.stringify(pageConfig.data)),
    ...pageConfig,
    setData(update) {
      Object.assign(this.data, update)
    }
  }

  return instance
}

test('handleLoginTap does not start login again when already logged in', () => {
  let loginCalled = false
  const page = loadProfilePage()
  page.data.isLoggedIn = true
  page.wechatLogin = () => {
    loginCalled = true
  }

  page.handleLoginTap()

  assert.equal(loginCalled, false)
})

test('handleLoginTap starts wechat login when user is logged out', () => {
  let loginCalled = false
  const page = loadProfilePage()
  page.wechatLogin = () => {
    loginCalled = true
  }

  page.handleLoginTap()

  assert.equal(loginCalled, true)
})

test('refreshUser resolves stored avatar urls through the api helper', () => {
  const page = loadProfilePage({
    api: {
      resolveMediaUrl(value) {
        return `resolved:${value}`
      }
    },
    wx: {
      getStorageSync(key) {
        if (key === 'token') return 'token-value'
        if (key === 'user') {
          return {
            nickname: 'Traveler',
            avatarUrl: '/uploads/avatars/a.png'
          }
        }
        return ''
      }
    }
  })

  page.refreshUser()

  assert.equal(page.data.isLoggedIn, true)
  assert.equal(page.data.nickname, 'Traveler')
  assert.equal(page.data.avatarUrl, 'resolved:/uploads/avatars/a.png')
})

test('onChooseAvatar previews the selected image before upload completes', async () => {
  let resolveUpload
  const uploadDone = new Promise((resolve) => {
    resolveUpload = resolve
  })
  const page = loadProfilePage({
    api: {
      uploadAvatar() {
        return uploadDone
      },
      resolveMediaUrl(value) {
        return value
      }
    }
  })
  page.data.isLoggedIn = true

  const uploadPromise = page.onChooseAvatar({
    detail: {
      avatarUrl: 'wxfile://avatar.png'
    }
  })

  assert.equal(page.data.avatarUrl, 'wxfile://avatar.png')

  resolveUpload({
    user: {
      nickname: 'Traveler',
      avatarUrl: 'https://example.com/avatar.png'
    }
  })

  await uploadPromise
})

test('onChooseAvatar uploads the selected avatar for logged in users', async () => {
  let uploadedFilePath = ''
  let toastTitle = ''
  const storage = {}
  const page = loadProfilePage({
    api: {
      uploadAvatar(filePath) {
        uploadedFilePath = filePath
        return Promise.resolve({
          user: {
            nickname: 'Traveler',
            avatarUrl: 'https://example.com/avatar.png'
          }
        })
      },
      resolveMediaUrl(value) {
        return value
      }
    },
    wx: {
      getStorageSync(key) {
        return storage[key] || ''
      },
      setStorageSync(key, value) {
        storage[key] = value
      },
      showToast(options) {
        toastTitle = options.title
      }
    }
  })
  page.data.isLoggedIn = true

  await page.onChooseAvatar({
    detail: {
      avatarUrl: 'wxfile://avatar.png'
    }
  })

  assert.equal(uploadedFilePath, 'wxfile://avatar.png')
  assert.deepEqual(JSON.parse(JSON.stringify(storage.user)), {
    nickname: 'Traveler',
    avatarUrl: 'https://example.com/avatar.png'
  })
  assert.equal(toastTitle, '头像已更新')
})

test('wechatLogin succeeds even when profile authorization is skipped', async () => {
  const storage = {}
  let toastTitle = ''
  const page = loadProfilePage({
    api: {
      resolveMediaUrl(value) {
        return value
      }
    },
    wechatAuth: {
      loginWithWechat() {
        return Promise.resolve({
          token: 'token-value',
          user: {
            nickname: 'Guest',
            avatarUrl: ''
          },
          profileDenied: true
        })
      }
    },
    wx: {
      getStorageSync(key) {
        return storage[key] || ''
      },
      setStorageSync(key, value) {
        storage[key] = value
      },
      showToast(options) {
        toastTitle = options.title
      }
    }
  })

  await page.wechatLogin()

  assert.equal(storage.token, 'token-value')
  assert.deepEqual(JSON.parse(JSON.stringify(storage.user)), {
    nickname: 'Guest',
    avatarUrl: ''
  })
  assert.equal(page.data.isLoggedIn, true)
  assert.equal(toastTitle, '登录成功')
})
