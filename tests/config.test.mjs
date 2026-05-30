import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

function loadConfig(getAppImpl) {
  const filename = path.join(__dirname, '../utils/config.js')
  const code = fs.readFileSync(filename, 'utf8')
  const module = { exports: {} }
  const sandbox = {
    module,
    exports: module.exports
  }

  if (getAppImpl) {
    sandbox.getApp = getAppImpl
  }

  vm.runInNewContext(code, sandbox, { filename })
  return module.exports
}

test('config module falls back to the production api url when getApp is unavailable', () => {
  const config = loadConfig()

  assert.equal(config.getApiBaseUrl(), 'https://cvnert.com.cn')
})

test('config module reads api url lazily from app global data', () => {
  const config = loadConfig(() => ({
    globalData: {
      apiBaseUrl: 'https://example.com'
    }
  }))

  assert.equal(config.getApiBaseUrl(), 'https://example.com')
})
