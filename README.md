# 🥗 family-serve-delicious: An AI-powered Meal Planning Assistant

`family-serve-delicious` is  project designed to act as an AI-powered meal planning assistant. This project is built as a Model Context Protocol (MCP) server, a specialized middleware designed to interface directly with a Large Language Model (LLM).

Its core purpose is to retrieve structured user data, format it into a clear and understandable context for the AI, and expose a set of "tools" that the LLM can use to interact with the data. This allows the LLM to provide personalized, healthy, and constraint-aware meal recommendations for groups and families.

## ✨ Features

🍽️ Personalized Meal Recommendations: Generates meal ideas tailored to the specific dietary needs, preferences, and health goals of each individual within a group.

🚫 Constraint Adherence: Strictly respects allergies, dietary restrictions, and dislikes of all group members, ensuring safe and appropriate suggestions.

👨‍👩‍👧‍👦 Group-Oriented Planning: Designed to understand and process the collective dietary profiles of multiple individuals within a "Group" context.

📄 Structured Data: Built upon a clear data model for Group and MemberProfile objects, ensuring robust and accurate context generation for the AI.

🥦 Health and Nutrition Focus: Emphasizes healthy and balanced meal proposals by considering age, gender, activity levels, and health goals.

🤖 LLM-Native Interaction: Designed to answer complex queries by providing LLMs with high-quality context (RAG) and actionable tools (Function Calling).

## 🛠️ How It Works: The MCP Flow

The server operates by following a clear protocol to mediate between the data and the AI:

1.  **Structured Data Source:** The foundation is a MongoDB database where user information is stored in a `groups` collection. Each document contains a group's details and an embedded array of `MemberProfile` objects, serving as the single source of truth.

2.  **Context Generation (RAG):** When a query is received, the server retrieves the relevant `Group` document. It then serializes this structured data into a clean, human-readable format (like Markdown) which is injected into the LLM's system prompt. This provides the AI with all the necessary context to reason about the group's needs.

3.  **Tool Exposition (Function Calling):** The server defines a clear set of tools that the LLM can use to perform actions, such as updating a user's allergies or creating a new meal plan. These tools are described via a schema, giving the AI actionable capabilities.

4.  **System Prompt:** A master prompt instructs the AI on its role as an expert culinary assistant, how to interpret the provided context, and how to use the available tools, ensuring strict adherence to all dietary constraints.

## 🚀 Getting Started

Further documentation will detail how to set up and interact with the `family-serve-delicious` MCP server. This will include information on API endpoints, data submission formats, and example queries.