const api = require('../../utils/api.js')

const USER_PROFILE_DESC = '用于完善旅行会员资料'

function buildProfileViewState(token, user) {
  const isLoggedIn = Boolean(token)
  const nickname = user.nickname || user.username || '微信用户'
  const avatarUrl = user.avatarUrl || user.avatarURL || ''

  return {
    isLoggedIn,
    nickname,
    avatarUrl,
    avatarText: nickname.slice(0, 1) || '旅',
    memberNameText: isLoggedIn ? nickname : '点击登录查看订单',
    memberDescText: isLoggedIn ? '旅行会员中心' : '登录后同步头像、购物车和订单',
    loginCopyText: isLoggedIn ? '订单、凭证和出行状态都可以在这里统一查看' : '登录后可加入购物车、支付并查询订单',
    showLoginButton: !isLoggedIn,
    showLogoutButton: isLoggedIn
  }
}

Page({
  data: {
    isLoggedIn: false,
    nickname: '',
    avatarUrl: '',
    avatarText: '旅',
    memberNameText: '点击登录查看订单',
    memberDescText: '登录后同步头像、购物车和订单',
    loginCopyText: '登录后可加入购物车、支付并查询订单',
    showLoginButton: true,
    showLogoutButton: false,
    loginLoading: false,
    profileLoading: false,
    orderItems: [
      { key: 'pay', icon: '付', label: '待支付' },
      { key: 'travel', icon: '行', label: '待出行' },
      { key: 'done', icon: '旅', label: '已出行' },
      { key: 'all', icon: '单', label: '全部订单' },
      { key: 'cart', icon: '车', label: '购物车' }
    ]
  },

  onShow() {
    this.refreshUser()
  },

  refreshUser() {
    const token = wx.getStorageSync('token')
    const user = wx.getStorageSync('user') || {}
    this.setData(buildProfileViewState(token, user))
  },

  handleLoginTap() {
    if (!this.data.isLoggedIn) {
      wx.showToast({ title: '请先登录', icon: 'none' })
    }
  },

  wechatLogin() {
    if (this.data.loginLoading) return
    this.setData({ loginLoading: true })
    this.getWechatLoginCode()
      .then(async (code) => {
        const result = await api.wechatLogin(code)
        wx.setStorageSync('token', result.token)
        wx.setStorageSync('user', result.user)
        this.refreshUser()
        wx.showToast({ title: '登录成功', icon: 'success' })
      })
      .catch((error) => {
        wx.showToast({ title: error.error || '微信登录失败', icon: 'none' })
      })
      .finally(() => {
        this.setData({ loginLoading: false })
      })
  },

  onChooseAvatar(event) {
    if (!this.data.isLoggedIn) {
      wx.showToast({ title: '请先登录', icon: 'none' })
      return
    }
    const avatarUrl = event.detail && event.detail.avatarUrl
    if (!avatarUrl) return
    this.saveWechatProfile({ avatarUrl }, '头像已更新')
  },

  saveWechatProfile(profile, successTitle) {
    if (this.data.profileLoading) return Promise.resolve()
    this.setData({ profileLoading: true })
    return api.updateWechatProfile(profile)
      .then((result) => {
        wx.setStorageSync('user', result.user)
        this.refreshUser()
        wx.showToast({ title: successTitle, icon: 'success' })
      })
      .catch((error) => {
        wx.showToast({ title: error.error || '资料更新失败', icon: 'none' })
      })
      .finally(() => {
        this.setData({ profileLoading: false })
      })
  },

  getWechatUserProfile() {
    return new Promise((resolve, reject) => {
      wx.getUserProfile({
        desc: USER_PROFILE_DESC,
        success: (res) => {
          const userInfo = res.userInfo || {}
          resolve({
            nickName: userInfo.nickName || '',
            avatarUrl: userInfo.avatarUrl || '',
            gender: userInfo.gender || 0,
            country: userInfo.country || '',
            province: userInfo.province || '',
            city: userInfo.city || '',
            language: userInfo.language || ''
          })
        },
        fail: () => reject({ error: '需要授权头像昵称后才能登录' })
      })
    })
  },

  getWechatLoginCode() {
    return new Promise((resolve, reject) => {
      wx.login({
        success: (loginResult) => {
          if (!loginResult.code) {
            reject({ error: '微信登录失败' })
            return
          }
          resolve(loginResult.code)
        },
        fail: () => reject({ error: '微信登录失败' })
      })
    })
  },

  openOrders(event) {
    if (!this.data.isLoggedIn) {
      wx.showToast({ title: '请先登录', icon: 'none' })
      return
    }

    const status = event && event.currentTarget && event.currentTarget.dataset
      ? event.currentTarget.dataset.status || ''
      : ''
    wx.navigateTo({
      url: `/pages/orders/index${status ? `?status=${status}` : ''}`
    })
  },

  openCart() {
    if (!this.data.isLoggedIn) {
      wx.showToast({ title: '请先登录', icon: 'none' })
      return
    }
    wx.switchTab({ url: '/pages/cart/index' })
  },

  handleOrderShortcut(event) {
    const { key } = event.currentTarget.dataset
    if (key === 'cart') {
      this.openCart()
      return
    }
    if (key === 'pay') {
      this.openOrders({ currentTarget: { dataset: { status: 'pending_payment' } } })
      return
    }
    if (key === 'travel') {
      this.openOrders({ currentTarget: { dataset: { status: 'pending_travel' } } })
      return
    }
    if (key === 'done') {
      this.openOrders({ currentTarget: { dataset: { status: 'completed' } } })
      return
    }
    this.openOrders({ currentTarget: { dataset: { status: '' } } })
  },

  logout() {
    wx.showModal({
      title: '退出登录',
      content: '确定要退出当前账号吗？',
      confirmText: '退出',
      confirmColor: '#ef4444',
      success: (res) => {
        if (!res.confirm) return
        wx.removeStorageSync('token')
        wx.removeStorageSync('user')
        this.refreshUser()
        wx.showToast({ title: '已退出登录', icon: 'none' })
      }
    })
  },

  showComingSoon() {
    wx.showToast({ title: '功能建设中', icon: 'none' })
  }
})
