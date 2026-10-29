# Schema Migration — Django → Prisma 8

Mapping from the legacy Django backend (`apps/backend/legacy/django`) to
`src/infrastructure/database/contract.prisma`.

**26 legacy tables → 22 models (one of them new, no legacy source).** The
reduction is concentrated in the exchange domain: 6 tables collapse into 2.
`PlannerState` is new — the legacy Django backend had no cross-device sync,
so nothing maps to it.

[![Database ERD](docs/erd.svg)](https://erddocs.com/#sql=v1.H4sIAAAAAAAAE81c3XIbN7K-11N08cbkCTm0ld1sSq6sI0u0V4n-VqI2J5VKidAMSCIaArMARjTX66q92gfYOs9wHmyf5FR3A_NDUrKcI9dGFzY5nMEAjUb_fP0BwyGUTkJhlVuIwdc7O8MhjMeX8Fqkt1Jn8O9__A9kwosb4SSkRnsrUr8zHOJ9h9KpmQZb5nIPjJZgzRIKacFKkQ-WxuYZ-LnSsz5oA1lZ5CoVXmbgvFV65ujyNBczh635ufCQCg2ZcmJmpYSl8nOQIp2D8XNpExjdSbuCXM5EuoLC5KuFscVcpXBjhU7n2Ep3Jv3oXToXeibHq0L2Qbnr1JTWyWv5rlBWeGV0H0SaysLL7ItU6FTmMoMbY3IptOuBov5YWeQixR9WIMApPcslSF0uIDV5udBJkMI3T_eHzV2qmbBWkNBhYTKZQ3ehrDWWu-LnEtxKp_CLuek9_fuxRYADEhjQ37__-S_o4FszibPS2YPj0dFBH06O6L8kSaA1-V0XRqCyPre29idSkcmFSmElhe0lccTPHHR4okBlHRC5lSJbAU-lA5Fa49zWBrEd1wdnYMIdT1Q2AeVIVlGeVdMgcqNlsjbWK618Y6yuvPlFpr6zB68P-3BwdnIeRgrixtEa6NNrB2KmjfMqTbb2LL5cviuMkw713Xlxk1M_psbi8nAgtVd-BUZTh68ujrcPs5r5ufKOFqbROSvEf5k0La2VOpX_hU13i7trkxq6osS1ynpbW1QO7pRT2B9szhlq7Px7_EHgu_xcepWCk1aJPIGTMveqyOXWxljADroymSWkI_AFK0mPlrWbCytJUxoSt2ZZz8RZNYhqJpSLU9FnWaHQ-6A0f-N3dva2duj1IQjPHdl9vvv74e5X_XCNelVfTJLts8eCaCrRZF2uk0p9wcoSh-_n28XjxEJCPU2kiKTS7fXAelxPw33NpWZRGKe8hK7KWBd7IHRGj2rhSytyuJWrrQ9302oGjsLD_SDLo6wHVqLAXW2xQWknrd-ulmilla5NJKmoLfV2mR7kwqGYhmgrlMnwk8gWSsMQZLDboLxcOBB5DvgdzHS6ta1aX9CT-IZefQ7b_Bls_YsEjg5Hp-Oj8Y9P3lt2HVdOWni_A6huaI_I8cK3KoPhEE5PRgd9oOXa2X2---XzF7tf_q6zA_RbmedkqL6AUqu_lnIPzo4OD0DkS7FyUFhzpzLpQHmyY-jx0aeaUnvXh5vSg-CGnC8zqT1YOZU0VxmQtmTKytTXc74QK9DyTlqYizsJuZnN6NYExnPJTVX3TnOzhEXpPDiv8hxuJFBfvYHUSlRYP5fKosnJzJI8U_fcOD-z0nFTHm9zcHp1fOxAOIw5vNKpx77xeEHpTL6TrpfsAMiFUHmQ3iv4lu_YAdC4qMP1HW75bW5uWBbSOfAK4xa8IfUwV9IKm85Xe3B5dT66uLocXcAfYf_w5OgU_gj4NYF9vTI6DJgCIP7ZWBA35o7lZArJvoJXTiG0zF822hRZpjDMEXm-4pbmJs8cZNJ5W6Ze3UkYgpO-LECkeKeDbiZz6SVGg7YPmTUFRKfZB-nThASBAUpqCpnFAXaXGLb5uVxRz0TqS3wrfgCje5CrO9QSzc_uY39DcBG-1YsY27cmp7AD9fYCP3-byakoc9_FgfVQxjzD2b6HQ-HlWC0aN2mz7PboLqmtyfOF1N5FczGqLv30M94RtMkdcIN4R7h0If9aSud_-hkAvrUyp5ix24k_0wPGdnrNVsbCziQ188hW-IFWI0dk97izjUvc3ar3oV3XGFD1qh0AJ52jGa3_LvkS_SzqKYi3NGalvqWeFxdvqS_RbawcJ9ILilXZvtBiP2j9QjcXudBa2ksvfHzveePSTz_vfCALe1YIXHxW6MwswJtbqcleaJh7X5xhwJMac6tkAgdz46QGgzbjux_G6DersQsrOYa_MymZBnSNB5cXb9ByeUk6X4WY8p1CcYb4a2qN9lJnSTChQXhkRdGezcXu778CM6WbuS_cT7JUYMUydtsFg1ZI65TzMtsDAYevIZfilhvr3oj0tiz6lGyoVPTR7rke2zZ0aSsl8wxKR2MIowsvdQkcG3NbFmGFCzfn8CN26k7kpXzJnSGJwFzN5gOpvTXFCsUlYCqcp0fBldOpSqXDVUiP_AmvBocB6DJ2gIzDUcOThEs8n1fxU63sU-y-24Of-MGf-7UbwKsKrxh9SJZnDw6Ew1Co97hFjsumUFa6xk248r_9lix3N76z17xWPfJzLyjcUzrd4RB2E7g6PfrL6OLyaPwjHOyP94_P3lJ0XSVxU2sWVdTIyWXI5z5TEPBGpGXuV6TBGHPq1aI1sag-nTejq_NO5dLiBL8KXm30DvVTefjFKL1XeQYK7G8kRmgy5KcOVV7kMKWXqiohONk_hyE3dn5xdjh6zQlBBjfSL6XU9QMcx4pwYcWNO1gIvYpJRnBF54RawNeowZhbqUXo5WJ3kVQW6ljpWxeFUJm5D1E6wR3VQRL9HWnPH4J8NtPIbjQfmPS2c9qGnOugC4V8nIyODppSbq4kbhpBi9YjHfg7dE7oX5ogfEOjk8Nh--UhoMPkJvjrds8LMaMcM4FTA2zPPbwZcUKhOVITGQV2XTQmJ-IXzFNXRYhJMpnmwlLk1-vDrSx8SGQlWLm0mJGgtudK3-IQ2u8l1fcxnitUeistJ5u5upX5Cq1JQr7iurQ5_jIzWu7B36Q1iD65ciEtzT7-3BbgY61GWWThJi8XhbEiT6pLXYodguJt1xtoJHGumYPUrvM-v1pqVUcjdbLy088ts4WTWFmnat0tdhfVSonrmXwaAx4fWQotO9BQ-DDSo6zWwrjqoHrNFnNePbdu0YPa32vWQ45Jqlt9hwbitOVl8aHHeg8WZtate1knt21v0LjK4t4P4E7sGM4YdFtAT4_dPF7LV7HhgeOgeCpSzpK7Kee5fXDpXGZlLvsx4e2HqJ0e4QAZQ49mHNw0TASThNjjMiIyew8gS6FH1HWVNVGleuVtgZE2oQ1e_y3IoteAjIIN3t_AieBWyoIjEcy8QrcC2EHWC8NWDNsY7BAhOWjAP0pHdKbCNAg_yc1MpSLneeGbvhru_iFgS4LhpIYdD1YcbXhlCETpjdKplRg4s0mo1HJNK4NSPo1OVh6hYdxfH7acQbUInVxI56WNFv4F_B12WUoTlOCExDJBlGYCC3MnM8x9awHuxduUQ7UbNCZR6Cw0xE-jB78TdhUnKMJ4KFI24A097L4-JGtPoBp24fUhN4YXGVVLhbUryBRFBNrDUqrZ3DuG7CTZdhdTyQlGnmEspc23DgW8MaSl-DRFqhgzu6oxLe2zmNSrhSRlGwScIJMh1O_Dcq7S-aY4XsbFEbG2lsucqnQursv0-k7J5b1tJI_PSpuuo-U5HrRKZ010vZ6NfpiZ_lr0Ab4schkFHsaC7aTCi9zMEpgEfLxG3rcBm-MmCFkDjmTeaszxRqYCK0ibMOgjIE9si1BPnoeAvHwqPImtBIQS_1eZ3IZGslFtKNZaxNda_PzujUvtcsG9doGf_oRsp3KLm46xVYx5GktURZAfjx9J0Pj3JjfCt1dHY2ZjUAndEq9dzzAFSFrL59W6hn3z73_8b68VylXmbzik-qODt6MxDOv3DHH9v1KZ-wZrMRRmSt8yBWHJ16aAW4tFJATUTIkh7mAqfYq1SZBUVDQtGGreyH2rZdzpMP4UEOwazt6I_LahJRHuboI753RtDd7ZguucFT7CN6qGiNYxoiruiYszBDu8qro_PbSqtsdFVTN1soTj3Vg5pEgPOtmm3oQIleQIKnijN5uGBrr1pGBf6m8_kuWJTqGxpM-_D55ljNUh5YDQyYW4DRapKbHGi958HzxIFxMUGuNRNvQmfGq-emtH_vkvFgyZxQfv5dcspNBKz6Zljql0AxkPMnEwK4UV2kv2hjcyN3qGn6JZ5Xaabp0H2CqhJC2P0zQv7V5tXl2vr2wzPA-Nc9MYVarUSn4bodALjCmev8B46E5gUR6hgyPtXz1hYudy4w-ayxcu45WNRfggZkxA7RtMZttrcBvOi7-8iWq1CfeOzcZKvq-VsYlttNY1ivNhtfu5Vy0yT6gzxWvNppNK8aPat5dH0nrjx9S8aTHOrZlK54xtWY0Ir6yhK0V1c2oyuQFXvWrXpuosCBFWo7GQblFtMKbNRXoLgnWtGygjTNyApQjLXccilzemticUMohMFBiAV0jsFCtAnEzRwtqCk6F6OVKpatA1rt2I4WKvc7xFQxfzsMkWykL4XWW9BPbjt1RobM9JeyfhZP_0x8ohYf9FRNU64w7kMvWllTTZYXklyYvn8TXa2AUIJPMAgn9cQxUaZDZDYM_VclsIeyspDXMSJkSoQd2Q2aRf52crTeEcQUCO6vwoDyjysv52zQYuCoK-hYSaf0HYiMlA0sqpsbIqINVLlTuKN-zB1OQZWhBKB72p476UTTf1yJR5Rk6gFk8QZqmtLKx0UlOwUEH-IWfHV0a1DS4O55kfXgfqxgTRjc8DUkf_Mnh3xj-d0b-jUGB9Dt_AZakzseLxR9bMJFNiAoM_wvMBcq4yhL0wVUbgn_1AzKXa0VhQ2H6oOVCN9a-ltCtU1kyszqY_SHkbLP1wCCdKlzhRTqF9X6hMY56WwDFPeYmvzmSqFiLvftl_0YM5BgUxCVqIbK0oe40JfS6Kbo8sB-bjU4wZ3UucGTlDCNdKTPCY6YWkFytz6p7zwnruUOhgVjJR60TpcCU3KV3ZsuaiSW8b88qWOLhnTa6B2qikQS-olFkU6BuVDsgz6WdEcxzpPT5B13e4AMN3chsuge8RHBWIlDowSw0MhMRFNakXxKROowLfAxsaeDOgBpWj-nqlnXGYpJrYSg2o0ZJDCTU1eIvz5qc-IUPh5RSzE3p7iH5jDLgtN-GnPhm4497141vXgtPqIs_iY5DP1vy3xFbHRJW-VMOMwvwcAq09HTRc5HYxNnr2q0XZbKMlzvYPn6Um9mUCl-MrJLrA5Xh_PPoczJxjg7gg19hicTZQT565qs7Biisc8lYpzEu2ZAo7TarJnchVxoanMI65cjGLFDXoYUqdDbxVBfu1uUxvif-0X_FfcjlTXi2ExzIH0zFiqcyapSMnTfakiTyP4QsYn_eiGtfRKOlwrMZu1GJDJfYp6rAPrfsnWfFPFNpjWFiz3gKsLRsRPaNnzG7huOMlgealtWZGHLcsqVYNi-mRBugpVXk4hN8lcH68P35zdnECB2enb47eXl3sj4_OTj_HsjmUubqRlrWyDuJjPQMrA5FLd1ZIzYDwcm6qOkOgimI0agcEvU2FHpjS74GVzuTk7uPNz2htNUDQPoSoYUBLhoJr5P0h2VPqoBsn5AMZ10NqFNG3hHbMXErgQgqKATsU11asUGJJdUDMZlbOiHVCdKrDo8vx0enBmN5MyCF657pLcbgYk0VPvY1CPiHmel2iRIcjMlkDn8V85ahYYc0SG4xMWz-3ppzNg3pmhVHaUzSh9PotVH_BULgPmSykpmEaHQLk0AGP-UxcRjTGyly0YCYyGb8xOOAeq0PxIPI68K_idmB-nsWrreu1DWlcRwO4icBvsRNCt0Bqx_Q6-U6kHhcF4ZvSwlLpjMtLbCMeGnC_GkI_dLqZEjdZcE07vk4FqOxuxbF5QsP-WWpca9bzEUXXhkTWoPmaa7SGDn-KDtfsJGgK8J5A61OF-J9aIRuS_jgY8_R-6vcJjP774E_7p29Hl0_ummifTXMfD6nE4dHF6GBMpb6lIQQmi_GVA7cUSIU72b_4fjQ-P94_GBFEimuZGEQgiFlL4FCaC7XYAbi6eItRKd6nq3gRhLutqvSiQKqzdEGGgeDIni5XU5mu0lwmrMCULzP_kKr6-DheJ4ZjKFeQQ0HWDLY2ibuQJsNJ3Ic0qTYiMQ1Kw4QauXbYyiTsnQLqANKtVCZpmw3n5SLPzVJmoI12UjscE7k-pNeEwpnMBjelH2jjB_zOXGbR6Z2PTg-PTt8i_LB_cDA6H48OgXj4hbBepaoQKOnY6z4E4g_Ll9wQClbes_EH8P4uy7zX4C8HGWdrPTjYPz0YHR-PDtm-G0vOLbNYikU6NCIj01ylnqo4MWC_VTggUL6tQzgHJWfM4RU7UI1xB-qXhYlG9z81ZWC2h3kjRqXDZEreKVO6fAVT3Kjm5TtPe1A6pfbsiwjraX6OwqcvYikUdnug9NTYBRmKDneYNOkvVdbBuoPdvjodX4z2ubf1p4vRd6MD_rj_w_7R-Oj07fXRKQaPHDPyaDZJ6QhlojHcJKczWVEubhCxEYTAIXcVOdxYK3RpjENshoGJM3D552M4uzgcXcDrH5nBfTi6ZH5ASM4RiFJUg2G8MSJEYiaUdh4m-NQElsbeImAikP-L9LGESPERsAze_CVT4rGdUucmkgHu58K3iO_DFu09YaFXdHMS9OXoAsVJL4G6qSDLC94X6OCQdjBEBcPNTgiTevq1cTV-vLKzBnmbssMJ0uomcachDyOo2to2xm6PKHjgtJpOUTBrIV5odq0y1yJ5VsFQWaos8F54XTXpX3GpbaXzbjDg-1BHC7GtLe4zlB8upYflPGxdYJuhKpMRmLCFTNUUqUTBFncb9rxH6x5b4PaEjgaEEno0mNGiW5ZHQrUCtI055wPEbqYSyBWHF3Vhob4cBv_qnsEH4n5j7M0Wtw4fm8fpg5ZP40gXzdKalaqmKpiqGLl-VzqP0mE8AhGD9nAddBfiHew-_93X6HxYlajGvpDOYY2-gZw2XNNWm1PvvIiGJ3ajUZuPZnd4J62arobviTr-Abq8YwYttAr2jbB9V21SC2zSyOEYhCEwdoLWiRQKE7x2PT4ykg8tFQbaveBNRcMA2sjhe5V9QFfynnGcPuTC-TBQmcEHbLt9KWYPT1l25Jr91mo9h8SeNiqzLrSD5XqS-nVv2regbNYi7LgUt7fZ0tbew1btvOn3t1o4xoK-YDx9i6Vj7gICbUsTgDnaSZ7nokD4AKs2GHwxOB5g8JjhEjORPHAklKWS4gze5Yj0orAPA3sxoCvt3dlUWrLKUyZOCxZtDsfNe9HYOk_E_PEPZ4zFYbqH4WQFIxUMFUSjhJcjYE_70ykamzegfiynDrEehXl9uMZhE2XtERvkWhWWwyKmGLKeVGgscsl3WJ1Ch7g7WIpVHeUIj2HZuhcgWgO6gLCYmoY9rq-N_UnbUpXq-U_I_YZD-AF35ECo8RCsWtWTGrv_G7HkNc7YMGArCHleh4JvMPAuHhVA5b6XcGP8nGISbZZUtYk7AS7QwSvcJUwbQblbe-BULrUnHVqYO0ZPJM3WM65Ccm1wmquwi6YTY1v4JhCDcPFWEW-HOBi2DGcTCJ74hXKOgxUnbWTJ55KMHtWPZSg04eYlCrlBTKcUDdaWG-MgKQiDLJuuqU5i_5_JfxTRGhHxN4EDoX1qUG8aVZmKhFMzjVjCB016wl6LufMxvk5Fge0-muJDilf1PfTgcZQf5jhvY_lwMx-j-jyG5VMNPkDzH6WhNIKXRwtu2-x9lHUS2STwcM8itaUP0Air6tmBp-5Z2EAk7aBhjsI6R7bF-vZkVae9HMOydUAbEiey-p3OTJEYn2Rsj9i_NAjEVGxi5xPJy2t-l5OsE4MpSxc5r8gBkAOpZ0pL2msleKcOUR0TosqE179m_KAOVaYid_KhKknkYzRE8cyxHcfLTaInne7CsXWFQlXeog-PBKQ2dunVB7LEZCHu1ya6N2n9R-iA9aq-h8SXJEmvzWoKVlzzXm_IG9spkcCIcWuKu5lfVhY87gonfxS8B5X9YnefwVdfDm5WPtgIhfGCmmLCnYqC31dFQMhFwuTaJZ8HofsqgdHpxdnx8QnmCBejP1-NLsdPj9U1o8eaHV3XKt1m-fLXpatPv_s06FpdBWP6OkaV7ZRsj3PzCPhFRILss59bGffVMNoWKR5zkYXNNRXQB19AA8572QC5iOVBhbSs3lMhYkI-YOxLLPnwg-Z2OyKrZFkvqfPJRpR3b0r56zLAJ0uKDOcFD5CdP3xctarkYsKFXqVne0DmbkIkWwcdOskAo1HGnariegeswNIaYlIaOiLDQL0T04bTwE9GrXprJLI0ecGyIpyfXY7hxmQrnl5iXCGJDB99D814Fl1R1Tf40ODL0V4p9TdpA2PLSl9ajYa95hRJxQdfjRv70hlJqLZhUiGQ8ho8dEMbX5HaoTBFmVPIjSei3LMGWYSPyBo2Fu8T5Q2_wVA05I1mSQXvutBtMdmTGdyp5u6HJA17MGOqI5FZSXMbVnJTIShHbV-KJFeDuXDYjsCzYs3yZetQgnAuCKXjfE94O1JY-2HjNCZGILRbIoKLkWtSn4iBA9oIEDCjeSg-CL35xFjgP1GU-kOCeO352cX4c7i5qXS4osMxZwwGxDInxvmpFUXc4N8k8iLHSuV05lgTPAstDN_rhUw_DN8HnVDZh-EinJ2RwDkyeFPUOz6jS0zpnBs0a4THa8whB3GpV4S3bQdx0CLHd7XrqWvF5imbgI0K6v3pJzb526g8Y09adefPomRfE0Pn9HR0wXw2mpirI0jnRuFZVLeB9ymoOjTACg_c5J_heIdgpxo8N9xdN8jknUqrLVF7Ie1o-D7yGqtnGN7jFnwu16EmYcjBBy4yrNYtC1S2F8979Y4qyKyY-ooJzMksHQCUIvyDTVEuQS033xrOb2QHhVsoQz9xmzHuYMiFnpVihp8MPksgoJnNciy5zVWWSR35uegCHZGEELGh84yoVx0gOg2fYCSmHhQeGhBHh6bX9TBGWhGHGinF-aU3Vsyq8wAnocxKtCaCnYMo4gYzQ6fR4QFSMpxsEU6Emct34V7ea6mNJtDxu8uz0x6agKxM6yMc34yw8mYo4K12tnaRn26sB0On4DDkiLf0IjwUe4ONhn3WgXCfzqUo-mGvUwf3V1H41wm_M2uqRORsYArHrmJGEDp3p6bO8-k13sBC2hlisBx_vBk1zqMjxDYc2MnjVH8LpOhwEE3cTfGaHsvKxQ2lwQ1RH-PZM9Q7Itcw7Eoer6XGscrLfLKSPFHdkTRXrPqFNTe5XODmUa4tTqqAc1LVGSmIJ6Yoov4DevlO2DnsvFgUcMO7DpAchr_i9PADpBe92Hf0YYEkt8f7zuMpQg2a4fpBl2d5xrtd4_FEZCgIHapPScMgkN4qPCWNOpxx5vBA1OqsLdbG6oyi5lFKW8gzW9KlX50y3WPVG6eS1BtLq52k8E1bGHF3_05IWSS0uxoPNFpffI4rIWapmyuplW_g3305R5s0E_c2_h8iqPdxA1cAAA)

---

## 1. Table mapping

### Identity

| Legacy table                | New model | Change                                                                                                                                                                                                                                                                                  |
| --------------------------- | --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| _(Django `auth_user`)_      | `User`    | New table. PK is the NMEC string, so there is no surrogate key to map. Legacy scattered `user_nmec` + `user_name` across six tables as plain columns. `email` is nullable + unique: OIDC provides it for real accounts, but students referenced in exchanges may never log in (see §7). |
| _(Django `django_session`)_ | `Session` | Opaque random token in an httpOnly cookie. Replaces Django's session table. The PK stores **sha256(token)**, never the raw cookie value.                                                                                                                                                |

`ExchangeAdmin` had **no successor table** — it was a one-column username list,
and it becomes the global access tier on `User.role` (`UserRole`).

### University catalog

| Legacy table               | New model                   | Change                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| -------------------------- | --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `faculty`                  | `Faculty`                   | `last_updated` dropped (see §4). The one-to-many `course` FK is gone — replaced by the explicit `FacultyCourse` m2m join (a course may be offered by several faculties).                                                                                                                                                                                                                                                                                                                                                                             |
| `course`                   | `Course`                    | `faculty` FK → explicit `facultyId` _removed_; see `FacultyCourse`. `plan_url` dropped (zero consumers — not even in the frontend types); `url` kept; `last_updated` dropped.                                                                                                                                                                                                                                                                                                                                                                        |
| `course_unit`              | `CourseUnit` + `Occurrence` | Split into two tables: `CourseUnit` is the abstract, year-agnostic subject (PK is a synthetic serial — Sigarra exposes no stable id on the URLs the sync hits); `Occurrence` is the (courseUnit, course, academic year) tuple whose PK is the Sigarra `pv_ocorrencia_id` (composite `(id, year)` because Sigarra reuses the same occurrence id across years). `ects`, `schedule_url` and the per-occurrence `hash` and `url` move onto `Occurrence`. The natural key `(courseUnitId, year, courseId)` rejects duplicate inserts inside one sync run. |
| `class`                    | `Class`                     | Composite FK `(occurrenceId, occurrenceYear) → Occurrence(id, year)`. `course_unit` is derivable via `class.occurrence.courseUnit`.                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `professor`                | `Professor`                 | Renamed columns for consistency (`professor_acronym` → `acronym`).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `slot`                     | `ScheduleSlot`              | Column renames only (`day` → 0-based `dayOfWeek`, `decimal(3,1)` hours → integer minutes). `classId` is **not** folded in — see `SlotClass`.                                                                                                                                                                                                                                                                                                                                                                                                         |
| `slot_class`               | `SlotClass`                 | **Kept as a real join table.** One lesson genuinely serves many classes: legacy `is_composed` marked slots shared by several classes (a "T" lecture shared by `1LEIC01`…`1LEIC10`), and the sync writes one slot plus one join row per class. Folding it into a single `classId` would make a shared lesson unrepresentable.                                                                                                                                                                                                                         |
| `slot_professor`           | `SlotProfessor`             | Now a composite PK `(slotId, professorId)` — legacy's table was shaped as OneToOne on `slot_id`, which silently limited a slot to one professor.                                                                                                                                                                                                                                                                                                                                                                                                     |
| `course_metadata`          | —                           | **Dropped.** Its only content was `ects`, which moved onto `Occurrence`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `course_group`             | —                           | **Dropped.** Legacy exposed two routes over it (`/course/<id>/groups`, `/course_group/<id>/course_units`), but the frontend never calls them and no other consumer is known. Confirm no external consumer before the legacy DB is retired.                                                                                                                                                                                                                                                                                                           |
| `course_unit_course_group` | —                           | **Dropped.** Only existed to join the two above.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |

### Student state

| Legacy table        | New model    | Change                                                                                                                                                                                 |
| ------------------- | ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `user_course_units` | `Enrollment` | `user_nmec` → `userId`; `course_unit` is **not** stored — it is derived via `class.occurrence.courseUnit`, since a class belongs to exactly one occurrence of exactly one course unit. |

### Platform configuration

| Legacy table                  | New model         | Change                                                                                                                                                                                           |
| ----------------------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `exchange_expirations`        | `ExchangePeriod`  | Now occurrence-scoped only (composite FK `(occurrenceId, occurrenceYear) → Occurrence(id, year)`). `is_course_expiration` **deleted**; `active_date`/`end_date` renamed `startsAt`/`endsAt`.     |
| `exchange_admin`              | —                 | **Dropped** → `User.role` (`UserRole`).                                                                                                                                                          |
| `exchange_admin_courses`      | `AdminCourse`     | `exchange_admin` FK → `userId`.                                                                                                                                                                  |
| `exchange_admin_course_units` | `AdminOccurrence` | `exchange_admin` FK → `userId`; the row is now scoped to an _occurrence_, not an abstract course unit (composite `(occurrenceId, occurrenceYear)`).                                              |
| `info`                        | —                 | **Dropped.** The scrape is now a manual populate step, so data-freshness signaling has no reader (the only frontend consumer, `/info/`, was dead code — commented-out cache-invalidation logic). |

### Exchanges — 6 tables → 2

| Legacy table                      | New model         | Change                                                                                                                                                                                                                                                                                            |
| --------------------------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `direct_exchange`                 | `ExchangeRequest` | `issuer_nmec` → `creatorId`; `issuer_name` dropped (join `User.name`); `accepted` + `canceled` → `status` enum; `admin_state` → `adminState` enum; `date` → `createdAt`; `last_validated` → `lastValidated`; `marketplace_exchange` FK → `targetUserId` + `status`. Gains a `type` discriminator. |
| `marketplace_exchange`            | `ExchangeRequest` | Same folds as above.                                                                                                                                                                                                                                                                              |
| `exchange_urgent_requests`        | `ExchangeRequest` | Same folds. `message` survives (urgent only).                                                                                                                                                                                                                                                     |
| `direct_exchange_participants`    | `ExchangeItem`    | **Gains `userId`** — two rows per swap, one per student. Class-name strings → `fromClassId`/`toClassId` FKs. `course_unit` acronym and `participant_name` dropped (joins).                                                                                                                        |
| `marketplace_exchange_class`      | `ExchangeItem`    | `userId` = the issuer; there is only one participant.                                                                                                                                                                                                                                             |
| `exchange_urgent_request_options` | `ExchangeItem`    | `userId` = the issuer.                                                                                                                                                                                                                                                                            |

### Enrollment requests

| Legacy table                     | New model                 | Change                                                                                                                  |
| -------------------------------- | ------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `course_unit_enrollments`        | `EnrollmentRequest`       | `user_nmec` → `userId`; `user_name` dropped; `accepted` → `status`; `admin_state` → `adminState`; `date` → `createdAt`. |
| `course_unit_enrollment_options` | `EnrollmentRequestOption` | `course_unit_enrollment` FK → `requestId`; `date` dropped.                                                              |
| `student_course_metadata`        | `StudentCourseMetadata`   | Unchanged.                                                                                                              |

### Cross-device planner state

| Legacy table | New model      | Change                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ------------ | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| _(none)_     | `PlannerState` | **New.** Stores the planner state as a `text` hash (the FE canonicalizes the planner object tree and hashes it), one row per (user, academic year). The Django backend had no cross-device sync — this was always localStorage on the FE, which is why this model has no legacy source. The BE is dumb storage: it stores whatever opaque string the FE sends. `updatedAt` (auto-bumped via `temporal.updatedAt()`) backs the FE's last-writer-wins merge; the hash itself lets the FE cheaply detect "no real change" writes. |

---

## 2. State mapping

Legacy stored lifecycle as free text plus booleans, which permitted contradictory
states such as _rejected but not cancelled_.

| Legacy representation                                                                | New                                        |
| ------------------------------------------------------------------------------------ | ------------------------------------------ |
| `accepted = true`, `canceled = false`                                                | `status = ACCEPTED`                        |
| `canceled = true`                                                                    | `status = CANCELLED`                       |
| `accepted = false, canceled = false`                                                 | `status = PENDING`                         |
| `accepted = true`, `canceled = true`                                                 | `status = CANCELLED` — **canceled wins**   |
| `admin_state = 'untreated'`                                                          | `adminState = UNTREATED`                   |
| `admin_state = 'treated'`                                                            | `adminState = TREATED`                     |
| `admin_state = 'rejected'`                                                           | `adminState = REJECTED`                    |
| `admin_state = 'awaiting-information'`                                               | `adminState = AWAITING_INFORMATION`        |
| `ExchangeUrgentRequestOptions` / `MarketplaceExchange` / `DirectExchange` (by table) | `type = URGENT` / `MARKETPLACE` / `DIRECT` |

The `accepted = true, canceled = true` row is real: `cancel_old_marketplace_exchanges()`
(in `MarketplaceExchangeView.py`) sets `canceled = True` on re-submission without
clearing `accepted`, so an already-claimed offer ends up with both flags set.
It means "was claimed, then superseded by a replacement" — i.e. no longer
active — so CANCELLED is the correct final status. Apply the rule in this order:
`canceled` first, then `accepted`.

The two axes are deliberately independent: an admin can approve a request while
the students are still deciding. Rejection exists in exactly one place
(`adminState`), so it can no longer disagree with `status`.

---

## 3. The `ExchangeItem` change

This is the one alteration that is not a mechanical rename, and it blocks
migration if skipped.

A direct exchange is a **swap**, so each side has its own origin class, its own
destination class, and its own accept flag. Legacy therefore wrote **two rows
per exchange choice** — see `ExchangeController.create_direct_exchange_participants()`:

```python
# other student's move
DirectExchangeParticipants(participant_nmec=other, goes_from=A, goes_to=B, ...)
# requester's move, mirrored
DirectExchangeParticipants(participant_nmec=auth_user, goes_from=B, goes_to=A, ...)
```

A single row without `userId` cannot represent this — you cannot tell whose move
is whose, nor when each side accepted.

`"accepted by all participants"` is now **derived** (`every item accepted`)
rather than stored, which is what `DirectExchangePendingMotive()` reverse-engineered
from the row set on every read.

Integrity of the class references is enforced at the DB level: `fromClassId` and
`toClassId` are **composite foreign keys**
`(fromClassId/toClassId, occurrenceId, occurrenceYear) → Class(id, occurrenceId, occurrenceYear)`,
so a referenced class is guaranteed to belong to the same occurrence as the item —
not merely to exist. `userId` uses `ON DELETE RESTRICT`: silently cascading away
one side's row would flip the derived "all accepted" to true with a side missing;
user deletion must explicitly cancel affected requests instead.

---

## 4. Columns dropped outright

| Column                                                   | Tables                                              | Why                                                                                                                                                                                                                                                        |
| -------------------------------------------------------- | --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `last_updated`                                           | `faculty`, `course`, `course_unit`, `class`, `slot` | Only ever written by the fetcher, never read by a route. No successor needed — the scrape is a manual populate step now.                                                                                                                                   |
| `plan_url`                                               | `course`                                            | No consumer — not even in the frontend types. `course.url` and `occurrence.url` stay: the Major type declares the former (no component reads it yet, but linking a course page is a likely rewrite use), and `InspectLessonBox` links out with the latter. |
| `is_course_expiration`                                   | `exchange_expirations`                              | Let the same row be visible through one endpoint and invisible through another, depending on the flag it was created with. Removed along with course-scoped periods.                                                                                       |
| `is_composed`                                            | `slot`                                              | Serialized into legacy class-schedule responses but never consumed by the frontend. Dropped as a column — the `SlotClass` join preserves the underlying fact (which classes share the slot), which is the only thing `is_composed` encoded.                |
| `schedule_url`                                           | `course_unit`                                       | No frontend consumer.                                                                                                                                                                                                                                      |
| `professor_id`                                           | `slot`                                              | Redundant with `slot_professor`.                                                                                                                                                                                                                           |
| `course_unit_id`                                         | `user_course_units`                                 | Derivable via `class.occurrence.courseUnit`.                                                                                                                                                                                                               |
| `course_unit`, `course_unit_name`, `course_unit_acronym` | option tables                                       | Denormalized copies that could silently disagree with the catalog.                                                                                                                                                                                         |
| `participant_name`, `issuer_name`, `user_name`           | option / exchange / enrollment tables               | Denormalized copies of `User.name`.                                                                                                                                                                                                                        |
| `date`                                                   | option tables                                       | Meaningless per-row; the parent row has `createdAt`.                                                                                                                                                                                                       |

---

## 5. Type changes

| Legacy                                                     | New                                           | Reason                                                                                                                    |
| ---------------------------------------------------------- | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `slot.start_time` / `slot.duration` — `decimal(3,1)` hours | `startMinute` / `durationMin` — `int` minutes | `exchange_overlap()` compared `hora_inicio / 3600` floats. Integers remove float comparison from the validation hot path. |
| `admin_state varchar(32)`                                  | `AdminValidationState` enum                   | Four magic strings, one of them hyphenated (`awaiting-information`).                                                      |
| `accepted` + `canceled` booleans                           | `ExchangeStatus` enum                         | See §2.                                                                                                                   |
| `course_unit_id varchar(16)` on option tables              | `(occurrenceId, occurrenceYear) int`          | Matches the `Occurrence` composite PK.                                                                                    |

---

## 6. Structural changes

| Concern                        | Legacy                                                                                                                                                                                                                    | New                                                                                                                            |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Overlap detection              | 3 separate implementations: `exchange/utils.py:125`, `ExchangeController.py:166`, and an inline copy in `build_marketplace_submission_schedule`. Same rule, subtly different, one doing DB lookups inside its inner loop. | One pure function over `{studentId → (classId → slot)}`.                                                                       |
| Exchange type dispatch         | `getExchangeType()` + `getOptionsDependinOnExchangeType()` sniffing Python types                                                                                                                                          | A `type` column                                                                                                                |
| Opening a course for exchanges | `ExchangeCoursePeriodView` looped all units of the course, inserting one row each with no transaction                                                                                                                     | Same fan-out, wrapped in a transaction with an overlap pre-check                                                               |
| Class ↔ slot                   | `slot` + `slot_class` join                                                                                                                                                                                                | Same join, kept as `SlotClass` — one lesson may serve many classes (shared "T" lectures), so a direct `classId` would be wrong |

---

## 7. Migration order

1. `User` — NMEC is the natural key and every other table references it.
2. `Faculty`, `FacultyCourse`, `Course`, `CourseUnit`, `Occurrence`, `Class`, `Professor`, `ScheduleSlot`, `SlotClass`, `SlotProfessor` — catalog, no dependencies on our side.
3. `AdminCourse`, `AdminOccurrence`.
4. `ExchangePeriod`.
5. `EnrollmentRequest` + `EnrollmentRequestOption`.
6. `ExchangeRequest` + `ExchangeItem` — **last, and hardest.**

### Four hazards in step 7

**Class names are strings on the option tables.** `class_participant_goes_from`
holds a name like `1LEIC01`, which must be resolved to a `Class.id` via
`(name, occurrenceId, occurrenceYear)`. Rows that fail to resolve have no valid
target and need a decision — quarantine them rather than dropping silently.

**Course-level periods collide.** `ExchangeCoursePeriodView` inserted one row
per unit flagged `is_course_expiration = True`, while a unit-level insert creates
the same `(occurrenceId, occurrenceYear, startsAt, endsAt)` tuple flagged
`False`. The new `@@id([occurrenceId, occurrenceYear, startsAt, endsAt])` will
reject the second one, so the migration must deduplicate before inserting.

**Duplicate direct-exchange items collide with the new unique key.**
`DirectExchangeView.post` does not reject repeated occurrence choices in the
request body, and legacy had no unique constraint on
`(direct_exchange, participant_nmec, course_unit_id)` — so the legacy tables can
contain duplicate requester rows. The new
`@@id([requestId, userId, occurrenceId, occurrenceYear])` will reject them
mid-insert. Check the legacy rows for duplicate
`(direct_exchange_id, participant_nmec, course_unit_id)` groups first; if any
exist, preserve distinct class moves and acceptance states with a lossless
mapping (e.g. an explicit legacy-id column), or quarantine them.

**Participants without accounts.** Legacy stored `participant_nmec` as free
text — the other student in a direct swap needs no TTS account (their schedule
is fetched straight from Sigarra, and acceptance happens via email link).
`ExchangeItem.userId` now references `User.id`, so every participant needs a
`User` row. Decide before migrating: either (a) create shadow `User` rows
(id = NMEC, name from Sigarra, `email = NULL` — the schema keeps this possible)
for legacy participants and at exchange-creation time, or (b) require login
before participating in an exchange (then legacy rows for never-registered
nmecs must be quarantined, not dropped). Do not invent fake emails.
`StudentCourseMetadata.nmec` has the same constraint — the same decision
applies to its rows.
