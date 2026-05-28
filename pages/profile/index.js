const api = require('../../utils/api')

const USER_PROFILE_DESC = '用于完善旅邦旅游会员资料'

Page({
  data: {
    isLoggedIn: false,
    nickname: '',
    avatarUrl: '',
    avatarText: '旅',
    loginLoading: false,
    profileLoading: false,
    orderItems: [
      { key: 'pay', icon: '￥', label: '待付款' },
      { key: 'ship', icon: '车', label: '待出行' },
      { key: 'receive', icon: '票', label: '待确认' },
      { key: 'comment', icon: '评', label: '待评价' },
      { key: 'refund', icon: '退', label: '退款/售后' }
    ]
  },

  onShow() {
    this.refreshUser()
  },

  refreshUser() {
    const token = wx.getStorageSync('token')
    const user = wx.getStorageSync('user') || {}
    const nickname = user.nickname || user.username || '微信用户'
    const avatarUrl = user.avatarUrl || user.avatarURL || ''
    this.setData({
      isLoggedIn: Boolean(token),
      nickname,
      avatarUrl,
      avatarText: nickname.slice(0, 1) || '旅'
    })
  },

  handleLoginTap() {
    if (!this.data.isLoggedIn) {
      wx.showToast({ title: '请先登录', icon: 'none' })
      return
    }
    this.updateWechatProfile()
  },

  wechatLogin() {
    if (this.data.loginLoading) return
    this.setData({ loginLoading: true })
    this.getWechatLoginCode()
      .then(async (code) => {
        const result = await api.wechatLogin(code)
        console.log('wechat login response', result)
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

  updateWechatProfile() {
    if (this.data.profileLoading) return
    this.setData({ profileLoading: true })
    this.getWechatUserProfile()
      .then(async (profile) => {
        const result = await api.updateWechatProfile(profile)
        console.log('wechat profile response', result)
        wx.setStorageSync('user', result.user)
        this.refreshUser()
        wx.showToast({ title: '头像已更新', icon: 'success' })
      })
      .catch((error) => {
        wx.showToast({ title: error.error || '头像授权失败', icon: 'none' })
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
