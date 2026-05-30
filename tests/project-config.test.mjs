import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

function readJson(relativePath) {
  const filename = path.join(__dirname, '..', relativePath)
  return JSON.parse(fs.readFileSync(filename, 'utf8'))
}

test('app registers cart and order pages required by checkout flow', () => {
  const appConfig = readJson('app.json')

  assert.ok(appConfig.pages.includes('pages/cart/index'))
  assert.ok(appConfig.pages.includes('pages/orders/index'))
  assert.ok(appConfig.pages.includes('pages/order-detail/index'))
})

test('tab bar exposes shopping cart as a main navigation entry', () => {
  const appConfig = readJson('app.json')
  const tabPaths = (appConfig.tabBar && appConfig.tabBar.list || []).map((item) => item.pagePath)

  assert.ok(tabPaths.includes('pages/cart/index'))
})

test('local devtools uses full compile for newly added pages', () => {
  const privateConfig = readJson('project.private.config.json')

  assert.equal(privateConfig.setting.compileHotReLoad, false)
})

test('pack options ignore local deployment artifacts', () => {
  const projectConfig = readJson('project.config.json')
  const ignoredFolders = projectConfig.packOptions.ignore
    .filter((item) => item.type === 'folder')
    .map((item) => item.value)

  assert.ok(ignoredFolders.includes('.git'))
  assert.ok(ignoredFolders.includes('.deploy-admin'))
  assert.ok(ignoredFolders.includes('.deploy-backend'))
  assert.ok(ignoredFolders.includes('.deploy-go-cache'))
  assert.ok(ignoredFolders.includes('.deploy-go-gopath'))
})

test('devtools keeps minify features off during local debugging', () => {
  const projectConfig = readJson('project.config.json')

  assert.equal(projectConfig.setting.minified, false)
  assert.equal(projectConfig.setting.minifyWXML, false)
  assert.equal(projectConfig.setting.minifyWXSS, false)
})

test('mini program package metadata does not opt js files into esm mode', () => {
  const packageConfig = readJson('package.json')

  assert.notEqual(packageConfig.type, 'module')
})
