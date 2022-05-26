class ChatToastIntegration {

    /**
     * ChatToastIntegration
     * @description Simple class which should link the `window.toaster` and `Chat`
     * @param megaChat {Chat}
     * @returns {ChatToastIntegration}
     * @constructor
     */

    constructor(megaChat) {
        window.addEventListener('offline', this.eventHandlerOffline);
        window.addEventListener('online', this.eventHandlerOnline);

        megaChat
            .rebind('onRoomInitialized.cTI', (e, megaRoom) => {
                let playingSound = false;
                megaRoom
                    .rebind('onCallPeerJoined.cTI', (e, userHandle) => {
                        const name = nicknames.getNickname(userHandle);
                        window.toaster.alerts.batch(
                            'onCallPeerJoined',
                            this.getTrimmedName(name),
                            {
                                level: 'low',
                                icon: 'sprite-fm-mono icon-chat-filled',
                                overrideOptions: ChatToastIntegration.DEFAULT_OPTS,
                                cb: () => {
                                    if (!playingSound) {
                                        ion.sound.stop('user_join_call');
                                        ion.sound.play('user_join_call');
                                    }
                                },
                                joiner: (arr) => {
                                    if (arr.length === 1) {
                                        /* `%s joined the call` */
                                        return l[24152].replace('%s', arr[0]);
                                    }
                                    else if (arr.length === 2) {
                                        /* `%s1 and %s2 joined the call` */
                                        return l[24153].replace('%s1', arr[0]).replace('%s2', arr[1]);
                                    }
                                    return mega.icu.format(
                                        /* `%s and # other(s) joined the call` */
                                        l.chat_call_joined_multi,
                                        arr.length - 1
                                    ).replace('%s', arr[0]);
                                }
                            }
                        );
                    })
                    .rebind('onCallPeerLeft.cTI', (e, { userHandle }) => {
                        if (navigator.onLine) {
                            if (megaRoom.activeCall && megaRoom.activeCall.sfuApp.isDestroyed) {
                                // Don't show leaving toasts if we are leaving.
                                return;
                            }
                            const name = nicknames.getNickname(userHandle);
                            if (megaRoom.type === 'private') {
                                // 1-1 call will show disconnect instead of showing peer left message.
                                return;
                            }
                            window.toaster.alerts.batch(
                                'onCallPeerLeft',
                                this.getTrimmedName(name),
                                {
                                    level: 'low',
                                    icon: 'sprite-fm-mono icon-chat-filled',
                                    overrideOptions: ChatToastIntegration.DEFAULT_OPTS,
                                    cb: () => {
                                        playingSound = true;
                                        ion.sound.stop('user_join_call');
                                        ion.sound.stop('user_left_call');
                                        ion.sound.play('user_left_call');
                                        onIdle(() => {
                                            playingSound = false;
                                        });
                                    },
                                    joiner: (arr) => {
                                        if (arr.length === 1) {
                                            /* `%s left the call` */
                                            return l[24154].replace('%s', arr[0]);
                                        }
                                        else if (arr.length === 2) {
                                            /* `%s1 and %s2 left the call` */
                                            return l[24155].replace('%s1', arr[0]).replace('%s2', arr[1]);
                                        }
                                        return mega.icu.format(
                                            /* `%s and # other(s) left the call` */
                                            l.chat_call_left_multi,
                                            arr.length - 1
                                        ).replace('%s', arr[0]);
                                    }
                                }
                            );
                        }
                    })
                    .rebind('onCallIJoined.cTI', () => {
                        const initialPriv = megaRoom.members[u_handle];
                        megaRoom.rebind('onMembersUpdated.cTI', ({ data }) => {
                            const { userId, priv } = data;
                            if (
                                userId === u_handle &&
                                priv === ChatRoom.MembersSet.PRIVILEGE_STATE.FULL &&
                                initialPriv !== ChatRoom.MembersSet.PRIVILEGE_STATE.FULL
                            ) {
                                window.toaster.alerts.low(
                                    l.chosen_moderator /* `You were chosen to be the moderator of this call` */,
                                    'sprite-fm-mono icon-chat-filled',
                                    ChatToastIntegration.DEFAULT_OPTS
                                );
                            }
                        });
                    })
                    .rebind('onCallPrivilegeChange', (e, userHandle, privilege) => {
                        const name = nicknames.getNickname(userHandle);
                        const role = privilege === ChatRoom.MembersSet.PRIVILEGE_STATE.FULL ? l[8875] : l[8874];

                        window.toaster.alerts.low(
                            /* %NAME was changed to %ROLE */
                            l.chat_user_role_change.replace('%NAME', this.getTrimmedName(name)).replace('%ROLE', role),
                            'sprite-fm-mono icon-chat-filled',
                            ChatToastIntegration.DEFAULT_OPTS
                        );
                    })
                    .rebind('onNoMicInput.cTI', () => {
                        if (megaRoom.activeCall) {
                            window.toaster.alerts.high(
                                l.chat_mic_off_toast /* Your mic is not working */,
                                'sprite-fm-mono icon-audio-off',
                                ChatToastIntegration.DEFAULT_OPTS
                            );
                        }
                    })
                    .rebind('onBadNetwork.cTI', () =>
                        window.toaster.alerts.medium(
                            l.poor_connection /* `Poor connection` */,
                            'sprite-fm-mono icon-call-offline',
                            ChatToastIntegration.DEFAULT_OPTS
                        )
                    )
                    .rebind('onRetryTimeout.cTI', () => {
                        window.toaster.alerts.hideAll();
                        window.toaster.alerts.high(
                            'Unable to reconnect',
                            'sprite-fm-mono icon-call-offline',
                            { ...ChatToastIntegration.DEFAULT_OPTS, timeout: 9e5 }
                        );
                    })
                    .rebind('onCallEnd.cTI', () => megaRoom.unbind('onMembersUpdated.cTI'));
            });
    }
    eventHandlerOffline() {
        if (!this.reconnecting) {
            this.reconnecting = true;
            window.toaster.alerts.medium(
                l.chat_offline /* `Chat is now offline` */,
                'sprite-fm-mono icon-chat-filled',
                ChatToastIntegration.DEFAULT_OPTS
            );
            window.toaster.alerts.show({
                content: l.reconnecting,
                icons: ['sprite-fm-mono icon-call-offline'],
                classes: ['medium'],
                timeout: 9e5
            });
        }
    }
    eventHandlerOnline() {
        this.reconnecting = false;
        window.toaster.alerts.hideAll();
        window.toaster.alerts.low(
            l.chat_online /* `Chat is now back online` */,
            'sprite-fm-mono icon-chat-filled',
            ChatToastIntegration.DEFAULT_OPTS
        );
        const { disconnectNotification } = megaChat.plugins.chatNotifications;
        if (disconnectNotification) {
            disconnectNotification.close();
        }
    }
    getTrimmedName(name) {
        const { MAX_NAME_CHARS } = ChatToastIntegration;
        const IN_CALL = document.body.classList.contains('in-call');

        if (IN_CALL) {
            return name.length > MAX_NAME_CHARS ? `${name.substr(0, MAX_NAME_CHARS)}...` : name;
        }

        return name;
    }
}

ChatToastIntegration.MAX_NAME_CHARS = 25;
ChatToastIntegration.DEFAULT_TIMEOUT = 5000;
ChatToastIntegration.DEFAULT_OPTS = { timeout: ChatToastIntegration.DEFAULT_TIMEOUT };