const api = require('./api.js')

function getWechatLoginCode() {
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
}

function getWechatUserProfile(desc) {
  return new Promise((resolve, reject) => {
    wx.getUserProfile({
      desc: desc,
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
      fail: (error) => reject(error || { error: '需要授权头像昵称后才能完善资料' })
    })
  })
}

function isProfileDenied(error) {
  var message = ''
  if (error) {
    message = String(error.error || error.errMsg || error.message || '').toLowerCase()
  }
  return message.indexOf('deny') >= 0 || message.indexOf('denied') >= 0
}

async function loginWithWechat(profileDesc) {
  const code = await getWechatLoginCode()
  const loginResult = await api.wechatLogin(code)
  let finalUser = loginResult.user || {}
  let profileDenied = false

  try {
    const profile = await getWechatUserProfile(profileDesc)
    const profileResult = await api.updateWechatProfile(profile)
    if (profileResult && profileResult.user) {
      finalUser = profileResult.user
    }
  } catch (error) {
    profileDenied = isProfileDenied(error)
  }

  return {
    token: loginResult.token,
    user: finalUser,
    profileDenied: profileDenied
  }
}

module.exports = {
  loginWithWechat: loginWithWechat
}
