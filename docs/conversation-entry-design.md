# Conversational Entry Flow for the Dallas College Success Coach Chatbot

## Overview

This document describes the conversational entry flow for the Dallas College Success Coach Chatbot. The goal is to create a simple and welcoming experience that helps students quickly find the information they need while allowing the chatbot to personalize responses when appropriate.

The design supports both first-time and returning users by keeping onboarding optional and making it easy to begin a conversation right away.

---

## Conversation Flow Diagram

![Conversation Entry Flow](https://github.com/Dallas-College-AI-Club/success-coach-chatbot/blob/40-design-conversational-entry-flow-for-student-chatbot/conversation-entry-flow.png)

---

## How the Flow Works

When a student launches the chatbot, it first determines whether they are a first-time or returning user.

If the student is new, the chatbot welcomes them and offers a few optional questions to better understand their needs. These questions are intended to personalize future responses, but students can skip them and begin chatting immediately.

If the student is returning, the chatbot loads any previously saved student context and provides a more personalized experience from the beginning.

---

## First-Time User Experience

The first-time user journey focuses on making the chatbot easy to use while keeping onboarding simple.

The chatbot welcomes the student and can ask optional questions such as:

- Which Dallas College campus do you attend?
- What is your major or program?
- Are you a new or returning student?

Students can either answer these questions or choose to skip onboarding. Regardless of their choice, they are presented with suggested questions to help them get started quickly.

Example suggested questions include:

- Registration Deadlines
- Campus Events
- Academic Calendar
- Financial Aid
- Tutoring Services
- Meet with a Success Coach

Students can also type their own question at any time.

---

## Returning User Experience

Returning students receive a welcome back message.

The chatbot loads any previously saved student context, such as:

- Campus
- Major
- Student Type

Using this information, the chatbot displays helpful quick actions like registration, academic calendar, campus events, financial aid, tutoring services, and Success Coach resources.

Students can either choose one of the suggested options or ask their own question.

---

## Context Gathering

The chatbot uses optional context-gathering questions to personalize conversations without creating unnecessary friction.

Students are never required to complete onboarding before receiving assistance, and they can choose to provide additional information later if they wish.
