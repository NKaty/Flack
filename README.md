# HarvardX CS50W: Web Programming with Python and JavaScript

### Project 2: Flack

Link to the course: https://www.edx.org/course/cs50s-web-programming-with-python-and-javascript

Link to the app: https://flack-gnan.onrender.com

#### Requirements:

- Display Name: When a user visits your web application for the first time, they should be prompted to type in a display name that will eventually be associated with every message the user sends. If a user closes the page and returns to your app later, the display name should still be remembered.
- Channel Creation: Any user should be able to create a new channel, so long as its name doesn’t conflict with the name of an existing channel.
- Channel List: Users should be able to see a list of all current channels, and selecting one should allow the user to view the channel. We leave it to you to decide how to display such a list.
- Messages View: Once a channel is selected, the user should see any messages that have already been sent in that channel, up to a maximum of 100 messages. Your app should only store the 100 most recent messages per channel in server-side memory.
- Sending Messages: Once in a channel, users should be able to send text messages to others in the channel. When a user sends a message, their display name and the timestamp of the message should be associated with the message. All users in the channel should then see the new message (with display name and timestamp) appear on their channel page. Sending and receiving messages should NOT require reloading the page.
- Remembering the Channel: If a user is on a channel page, closes the web browser window, and goes back to your web application, your application should remember what channel the user was on previously and take the user back to that channel.
- Personal Touch: Add at least one additional feature to your chat application of your choosing!

#### Implementation:

- Display Name: A new user is able to register for the chat providing a username, email and password. Once registered, the user can log in to the chat and logout out of the chat.
- Channel Creation: A registered user can create a new channel providing a name and description. If the channel is created successfully, the new channel appears in each user's channel list. The newly created channel becomes selected for the creator. If a channel with the same name already exists, the creator receives an error message.
- Channel List: The chat view is divided into three areas: a list of channels, messages of the selected channel, information about the selected channel. When the user selects a channel, the contents of the messages area and information area change.
- Messages View: All the app data as well as the chat history is stored in the database (PostgreSQL). Channel messages are loaded in batches as the user scrolls the messages area. Scroll loading is also implemented for the list of channels. 
- Sending Messages: Once in a channel, users can send text messages to others in the channel. A new message appears in the messages area of each user who is currently in the channel without reloading the page. Every displayed message has a timestamp (taking into account the time zone of the user for whom the message is displayed), the username and avatar of the author. The avatar is taken from Gravatar, the avatar service.
- Remembering the Channel: The user's current channel is stored in the database, so whenever the user goes back to the app, they are taken back to their previous channel.
- Personal Touch: Users can attach a file to their message, pin and unpin channels. They also can see additional information about the selected channel such as a channel description, when and by whom the channel was created, a list of users, who are currently in the channel. A list of users is updated whenever users join or leave the channel. Scroll loading is also implemented for a list of users.