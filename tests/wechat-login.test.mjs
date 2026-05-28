import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

function loadApi(request) {
  const filename = path.join(__dirname, '../utils/api.js')
  const code = fs.readFileSync(filename, 'utf8')
  const module = { exports: {} }
  const sandbox = {
    module,
    exports: module.exports,
    require(id) {
      if (id === './request') {
        return { request }
      }
      throw new Error(`unexpected require: ${id}`)
    }
  }
  vm.runInNewContext(code, sandbox, { filename })
  return module.exports
}

test('wechatLogin sends only the login code to the backend', async () => {
  let capturedOptions = null
  const api = loadApi(async (options) => {
    capturedOptions = options
    return { token: 'token-value', user: { id: 'user-id' } }
  })

  await api.wechatLogin('code-123')

  assert.ok(capturedOptions)
  assert.equal(capturedOptions.url, '/api/auth/wechat-login')
  assert.equal(capturedOptions.method, 'POST')
  assert.deepEqual(JSON.parse(JSON.stringify(capturedOptions.data)), {
    code: 'code-123'
  })
})

test('updateWechatProfile sends authorized profile to the backend', async () => {
  let capturedOptions = null
  const api = loadApi(async (options) => {
    capturedOptions = options
    return { user: { id: 'user-id' } }
  })

  const profile = {
    nickName: '旅人',
    avatarUrl: 'https://example.com/avatar.png',
    gender: 1,
    country: 'CN',
    province: 'Guangdong',
    city: 'Shenzhen',
    language: 'zh_CN'
  }

  await api.updateWechatProfile(profile)

  assert.ok(capturedOptions)
  assert.equal(capturedOptions.url, '/api/auth/wechat-profile')
  assert.equal(capturedOptions.method, 'PUT')
  assert.deepEqual(JSON.parse(JSON.stringify(capturedOptions.data)), {
    profile
  })
})
