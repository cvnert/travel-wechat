function isLoggedIn() {
  return Boolean(wx.getStorageSync('token'))
}

function requireLogin(message) {
  if (isLoggedIn()) {
    return true
  }

  wx.showModal({
    title: '需要登录',
    content: message || '登录后可继续操作',
    confirmText: '去登录',
    success(res) {
      if (res.confirm) {
        wx.switchTab({ url: '/pages/profile/index' })
      }
    }
  })
  return false
}

module.exports = {
  isLoggedIn,
  requireLogin
}
