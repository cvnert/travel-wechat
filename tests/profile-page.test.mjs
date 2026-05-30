import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

function loadProfilePage({ api = {}, wx = {} } = {}) {
  const filename = path.join(__dirname, '../pages/profile/index.js')
  const code = fs.readFileSync(filename, 'utf8')
  let pageConfig = null
  const sandbox = {
    require(id) {
      const normalizedId = id.replace(/\.js$/, '')
      if (normalizedId === '../../utils/api') {
        return api
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

test('handleLoginTap does not refresh WeChat profile when already logged in', () => {
  let updateCalled = false
  const page = loadProfilePage()
  page.data.isLoggedIn = true
  page.updateWechatProfile = () => {
    updateCalled = true
  }

  page.handleLoginTap()

  assert.equal(updateCalled, false)
})

test('onChooseAvatar saves the selected avatar for logged in users', () => {
  let savedProfile = null
  let successTitle = ''
  const page = loadProfilePage()
  page.data.isLoggedIn = true
  page.saveWechatProfile = (profile, title) => {
    savedProfile = profile
    successTitle = title
  }

  page.onChooseAvatar({
    detail: {
      avatarUrl: 'wxfile://avatar.png'
    }
  })

  assert.deepEqual(JSON.parse(JSON.stringify(savedProfile)), {
    avatarUrl: 'wxfile://avatar.png'
  })
  assert.equal(successTitle, '头像已更新')
})
